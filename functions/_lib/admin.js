// Admin API handlers (all routes except login require a signed session cookie).
import {
  HttpError, json, readJson, clientIp, rateLimit, hmacHex, safeEqual, cleanText, isEmail,
  getSettings, saveSettings, loadCatalog, parseJsonArray
} from './util.js';

const COOKIE = 'gg_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;
const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

function ensureConfigured(env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    throw new HttpError(503, 'Admin is not configured. Set ADMIN_PASSWORD and SESSION_SECRET.');
  }
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

async function makeToken(env, expires) {
  return `${expires}.${await hmacHex(String(env.SESSION_SECRET).trim(), `admin.${expires}`)}`;
}

export async function isAuthed(request, env) {
  if (!env.SESSION_SECRET) return false;
  const [exp, sig] = readCookie(request, COOKIE).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmacHex(String(env.SESSION_SECRET).trim(), `admin.${exp}`));
}

function cookieHeader(value, maxAge, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

async function login({ request, env }) {
  ensureConfigured(env);
  const ip = clientIp(request);
  if (!(await rateLimit(env.DB, `login:${ip}`, 6, 900))) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
  const body = await readJson(request, 2048);
  const ok = await safeEqual(String(body.password || '').trim(), String(env.ADMIN_PASSWORD).trim());
  if (!ok) throw new HttpError(401, 'Wrong password.');
  const token = await makeToken(env, Date.now() + SESSION_MS);
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(token, SESSION_MS / 1000, request) });
}

const int = (v, label, { min = 0, max = 10_000_000, allowNull = false } = {}) => {
  if ((v === null || v === '' || v === undefined) && allowNull) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  return n;
};

function cleanList(value, label, maxItems, maxLen) {
  const list = (Array.isArray(value) ? value : []).map((x) => cleanText(x, 1, maxLen, label));
  const unique = [...new Set(list)];
  if (!unique.length) throw new HttpError(400, `${label} needs at least one value.`);
  if (unique.length > maxItems) throw new HttpError(400, `${label} has too many values.`);
  return unique;
}

function validateProduct(body) {
  const category = String(body.category || '');
  if (!['men', 'women', 'acc'].includes(category)) throw new HttpError(400, 'Choose a category.');
  const image = String(body.image || '').trim();
  if (!/^(\/assets\/images\/[\w.\-]+|\/api\/images\/\d+|https:\/\/[^\s"'<>]+)$/.test(image)) {
    throw new HttpError(400, 'Upload an image (or provide a valid image path/URL).');
  }
  const price = int(body.price, 'Price', { min: 1 });
  const compareAt = int(body.compareAt, 'Compare-at price', { min: 1, allowNull: true });
  if (compareAt !== null && compareAt <= price) throw new HttpError(400, 'Compare-at price must be higher than the price.');
  return {
    sku: cleanText(body.sku, 2, 20, 'SKU').toUpperCase(),
    name: cleanText(body.name, 2, 80, 'Name'),
    category,
    price,
    compareAt,
    summary: cleanText(body.summary || '', 0, 300, 'Summary'),
    specs: (Array.isArray(body.specs) ? body.specs : []).map((s) => cleanText(s, 1, 80, 'Spec')).slice(0, 10),
    image,
    sizes: cleanList(body.sizes, 'Sizes', 12, 12),
    colors: cleanList(body.colors, 'Colours', 10, 30),
    active: body.active === false || body.active === 0 ? 0 : 1,
    sortOrder: int(body.sortOrder ?? 0, 'Sort order', { min: 0, max: 100000 }),
    stock: body.stock && typeof body.stock === 'object' ? body.stock : {}
  };
}

async function saveProduct(db, id, p) {
  const specs = JSON.stringify(p.specs);
  const sizes = JSON.stringify(p.sizes);
  const colors = JSON.stringify(p.colors);
  try {
    if (id === null) {
      await db
        .prepare(
          `INSERT INTO products (sku, name, category, price, compare_at, summary, specs, image, colors, sizes, active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(p.sku, p.name, p.category, p.price, p.compareAt, p.summary, specs, p.image, colors, sizes, p.active, p.sortOrder)
        .run();
      id = (await db.prepare('SELECT id FROM products WHERE sku = ?').bind(p.sku).first()).id;
    } else {
      const res = await db
        .prepare(
          `UPDATE products SET sku=?, name=?, category=?, price=?, compare_at=?, summary=?, specs=?, image=?, colors=?, sizes=?, active=?, sort_order=? WHERE id=?`
        )
        .bind(p.sku, p.name, p.category, p.price, p.compareAt, p.summary, specs, p.image, colors, sizes, p.active, p.sortOrder, id)
        .run();
      if (!res.meta.changes) throw new HttpError(404, 'Product not found.');
    }
  } catch (err) {
    if (/UNIQUE constraint failed: products\.sku/i.test(String(err.message))) throw new HttpError(409, 'That SKU already exists.');
    throw err;
  }

  // Sync the size x colour grid (stock blank/null = not tracked).
  const combos = [];
  p.sizes.forEach((size) => p.colors.forEach((color) => combos.push({ size, color })));
  const keep = new Set(combos.map((c) => `${c.size}|${c.color}`));
  const existing = await db.prepare('SELECT size, color FROM variants WHERE product_id = ?').bind(id).all();
  const statements = [];
  existing.results.forEach((v) => {
    if (!keep.has(`${v.size}|${v.color}`)) {
      statements.push(db.prepare('DELETE FROM variants WHERE product_id = ? AND size = ? AND color = ?').bind(id, v.size, v.color));
    }
  });
  combos.forEach(({ size, color }) => {
    const raw = p.stock[`${size}|${color}`];
    const stock = raw === null || raw === '' || raw === undefined ? null : int(raw, 'Stock', { min: 0, max: 100000 });
    statements.push(
      db
        .prepare(
          'INSERT INTO variants (product_id, size, color, stock) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(product_id, size, color) DO UPDATE SET stock = excluded.stock'
        )
        .bind(id, size, color, stock)
    );
  });
  if (statements.length) await db.batch(statements);
  return id;
}

function detectImageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}

async function uploadImage({ request, env }) {
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > 1_000_000) throw new HttpError(413, 'Image must be under 1 MB.');
  const bytes = new Uint8Array(buffer);
  const mime = detectImageType(bytes);
  if (!mime) throw new HttpError(415, 'Only JPEG, PNG or WebP images are allowed.');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  await env.DB.prepare('INSERT INTO images (mime, data_b64) VALUES (?, ?)').bind(mime, btoa(bin)).run();
  const row = await env.DB.prepare('SELECT MAX(id) AS id FROM images').first();
  return json({ url: `/api/images/${row.id}` }, 201);
}

async function listOrders({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = (url.searchParams.get('q') || '').trim();
  const where = [];
  const binds = [];
  if (status && STATUSES.includes(status)) {
    where.push('o.status = ?');
    binds.push(status);
  }
  if (q) {
    where.push('(o.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await env.DB
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
              (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o JOIN customers c ON c.id = o.customer_id ${clause}
       ORDER BY o.id DESC LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();
  const count = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id ${clause}`)
    .bind(...binds)
    .first();
  return json({ orders: rows.results, total: count.n });
}

async function getOrder({ env }, id) {
  const order = await env.DB
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`
    )
    .bind(id)
    .first();
  if (!order) throw new HttpError(404, 'Order not found.');
  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all();
  return json({ order, items: items.results });
}

async function updateOrder({ request, env }, id) {
  const body = await readJson(request);
  const order = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw new HttpError(404, 'Order not found.');
  const statements = [];
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status.');
    if (order.status === 'cancelled' && body.status !== 'cancelled') {
      throw new HttpError(409, 'A cancelled order cannot be reopened. Create a new order instead.');
    }
    if (body.status === 'cancelled' && order.status !== 'cancelled') {
      const items = await env.DB.prepare('SELECT product_id, size, color, qty FROM order_items WHERE order_id = ?').bind(id).all();
      items.results.forEach((i) =>
        statements.push(
          env.DB
            .prepare('UPDATE variants SET stock = stock + ? WHERE product_id = ? AND size = ? AND color = ? AND stock IS NOT NULL')
            .bind(i.qty, i.product_id, i.size, i.color)
        )
      );
    }
    statements.push(env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(body.status, id));
  }
  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus)) throw new HttpError(400, 'Invalid payment status.');
    statements.push(env.DB.prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").bind(body.paymentStatus, id));
  }
  if (!statements.length) throw new HttpError(400, 'Nothing to update.');
  await env.DB.batch(statements);
  return getOrder({ env }, id);
}

async function listCustomers({ env }) {
  const rows = await env.DB
    .prepare(
      `SELECT c.id, c.name, c.phone, c.email, c.created_at,
              COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total END), 0) AS spent,
              MAX(o.created_at) AS last_order
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id ORDER BY spent DESC, c.id DESC LIMIT 500`
    )
    .all();
  return json({ customers: rows.results });
}

function validatePromo(body, requireCode = true) {
  const out = {};
  if (requireCode) {
    out.code = cleanText(body.code, 3, 20, 'Code').toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(out.code)) throw new HttpError(400, 'Code may only contain letters, numbers, - and _.');
  }
  out.percent = int(body.percent, 'Percent', { min: 1, max: 90 });
  out.active = body.active === false || body.active === 0 ? 0 : 1;
  out.minSubtotal = int(body.minSubtotal ?? 0, 'Minimum order', { min: 0 });
  out.maxUses = int(body.maxUses, 'Max uses', { min: 1, allowNull: true });
  if (body.expiresAt) {
    const d = new Date(`${body.expiresAt}T23:59:59Z`);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid expiry date.');
    out.expiresAt = `${body.expiresAt} 23:59:59`;
  } else {
    out.expiresAt = null;
  }
  return out;
}

function validateSettings(body) {
  const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
  if (whatsapp.length < 8 || whatsapp.length > 15) throw new HttpError(400, 'WhatsApp number must be digits only with country code (e.g. 201012345678).');
  const guide = Array.isArray(body.sizeGuide) ? body.sizeGuide : [];
  if (guide.length < 2 || guide.length > 10) throw new HttpError(400, 'Size guide needs between 2 and 10 sizes.');
  let prev = 0;
  const sizeGuide = guide.map((row, i) => {
    const size = cleanText(row.size, 1, 8, 'Size');
    const last = i === guide.length - 1;
    if (last) return { size, below: null };
    const below = Number(row.below);
    if (!Number.isFinite(below) || below <= prev || below > 400) throw new HttpError(400, 'Weight limits must increase from one size to the next.');
    prev = below;
    return { size, below };
  });
  if (new Set(sizeGuide.map((r) => r.size)).size !== sizeGuide.length) throw new HttpError(400, 'Duplicate size names in the size guide.');
  return {
    whatsapp,
    shippingFee: int(body.shippingFee, 'Shipping fee', { min: 0, max: 10000 }),
    freeShippingThreshold: int(body.freeShippingThreshold, 'Free-shipping threshold', { min: 0, max: 1_000_000 }),
    sizeGuide,
    tallCm: int(body.tallCm, 'Tall height (cm)', { min: 150, max: 230 }),
    shortCm: int(body.shortCm, 'Short height (cm)', { min: 120, max: 200 }),
    welcomePromo: body.welcomePromo ? cleanText(body.welcomePromo, 3, 20, 'Welcome code').toUpperCase() : ''
  };
}

async function stats({ env }) {
  const db = env.DB;
  const totals = await db
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' AND status != 'cancelled' THEN total END), 0) AS paid_revenue,
              COALESCE(SUM(CASE WHEN status = 'new' THEN 1 END), 0) AS new_orders
       FROM orders`
    )
    .first();
  const byStatus = await db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
  const daily = await db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue
       FROM orders WHERE status != 'cancelled' AND created_at >= datetime('now', '-30 days')
       GROUP BY day ORDER BY day`
    )
    .all();
  const top = await db
    .prepare(
      `SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
       GROUP BY oi.product_id ORDER BY qty DESC LIMIT 5`
    )
    .all();
  const low = await db
    .prepare(
      `SELECT p.name, v.size, v.color, v.stock FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.stock IS NOT NULL AND v.stock <= 3 AND p.active = 1 ORDER BY v.stock, p.name LIMIT 20`
    )
    .all();
  const counts = await db
    .prepare('SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM subscribers) AS subscribers, (SELECT COUNT(*) FROM products WHERE active = 1) AS products')
    .first();
  const nonCancelled = totals.orders - (byStatus.results.find((s) => s.status === 'cancelled')?.n || 0);
  return json({
    totals: { ...totals, avgOrder: nonCancelled ? Math.round(totals.revenue / nonCancelled) : 0 },
    byStatus: byStatus.results,
    daily: daily.results,
    topProducts: top.results,
    lowStock: low.results,
    counts
  });
}

export async function handleAdmin(context, segs) {
  const { request, env } = context;
  const method = request.method;
  const [a, b] = segs;

  if (a === 'login' && method === 'POST') return login(context);
  ensureConfigured(env);
  if (a === 'me' && method === 'GET') return json({ authed: await isAuthed(request, env) });
  if (a === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0, request) });
  }
  if (!(await isAuthed(request, env))) throw new HttpError(401, 'Please sign in.');
  const id = b !== undefined ? Number(b) : null;
  const idOk = id !== null && Number.isInteger(id) && id > 0;

  if (a === 'stats' && method === 'GET') return stats(context);

  if (a === 'products') {
    if (method === 'GET' && b === undefined) return json({ products: await loadCatalog(env.DB, { includeInactive: true }) });
    if (method === 'POST' && b === undefined) {
      const newId = await saveProduct(env.DB, null, validateProduct(await readJson(request)));
      return json({ id: newId }, 201);
    }
    if (method === 'PUT' && idOk) {
      await saveProduct(env.DB, id, validateProduct(await readJson(request)));
      return json({ ok: true });
    }
    if (method === 'DELETE' && idOk) {
      const used = await env.DB.prepare('SELECT 1 AS x FROM order_items WHERE product_id = ? LIMIT 1').bind(id).first();
      if (used) {
        await env.DB.prepare('UPDATE products SET active = 0 WHERE id = ?').bind(id).run();
        return json({ ok: true, deactivated: true });
      }
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      return json({ ok: true, deleted: true });
    }
  }

  if (a === 'upload' && method === 'POST') return uploadImage(context);

  if (a === 'orders') {
    if (method === 'GET' && b === undefined) return listOrders(context);
    if (method === 'GET' && idOk) return getOrder(context, id);
    if (method === 'PATCH' && idOk) return updateOrder(context, id);
  }

  if (a === 'customers' && method === 'GET') return listCustomers(context);

  if (a === 'promos') {
    if (method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM promo_codes ORDER BY code').all();
      return json({ promos: rows.results });
    }
    if (method === 'POST') {
      const p = validatePromo(await readJson(request));
      try {
        await env.DB
          .prepare('INSERT INTO promo_codes (code, percent, active, min_subtotal, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(p.code, p.percent, p.active, p.minSubtotal, p.maxUses, p.expiresAt)
          .run();
      } catch (err) {
        if (/UNIQUE|PRIMARY KEY/i.test(String(err.message))) throw new HttpError(409, 'That code already exists.');
        throw err;
      }
      return json({ ok: true }, 201);
    }
    if (method === 'PUT' && b) {
      const p = validatePromo(await readJson(request), false);
      const res = await env.DB
        .prepare('UPDATE promo_codes SET percent=?, active=?, min_subtotal=?, max_uses=?, expires_at=? WHERE code=?')
        .bind(p.percent, p.active, p.minSubtotal, p.maxUses, p.expiresAt, String(b).toUpperCase())
        .run();
      if (!res.meta.changes) throw new HttpError(404, 'Code not found.');
      return json({ ok: true });
    }
    if (method === 'DELETE' && b) {
      await env.DB.prepare('DELETE FROM promo_codes WHERE code = ?').bind(String(b).toUpperCase()).run();
      return json({ ok: true });
    }
  }

  if (a === 'settings') {
    if (method === 'GET') return json({ settings: await getSettings(env.DB) });
    if (method === 'PUT') {
      await saveSettings(env.DB, validateSettings(await readJson(request)));
      return json({ settings: await getSettings(env.DB) });
    }
  }

  if (a === 'subscribers' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT email, created_at FROM subscribers ORDER BY id DESC LIMIT 1000').all();
    return json({ subscribers: rows.results });
  }

  throw new HttpError(404, 'Not found');
}
