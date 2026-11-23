// Admin Catalog, Variant Stock Sync, Image Upload, Orders, Promos & Settings.
import { HttpError, json, readJson, cleanText } from './util.js';

export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

export const parseInteger = (v, label, { min = 0, max = 10_000_000, allowNull = false } = {}) => {
  if ((v === null || v === '' || v === undefined) && allowNull) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  }
  return n;
};

function cleanStringList(value, label, maxItems, maxLen) {
  const list = (Array.isArray(value) ? value : []).map((x) => cleanText(x, 1, maxLen, label));
  const unique = [...new Set(list)];
  if (!unique.length) throw new HttpError(400, `${label} needs at least one value.`);
  if (unique.length > maxItems) throw new HttpError(400, `${label} has too many values.`);
  return unique;
}

export function validateProductPayload(body) {
  const category = String(body.category || '');
  if (!['men', 'women', 'acc'].includes(category)) throw new HttpError(400, 'Choose a category.');
  const image = String(body.image || '').trim();
  if (!/^(\/assets\/images\/[\w.\-]+|\/api\/images\/\d+|https:\/\/[^\s"'<>]+)$/.test(image)) {
    throw new HttpError(400, 'Upload an image (or provide a valid image path/URL).');
  }
  const price = parseInteger(body.price, 'Price', { min: 1 });
  const compareAt = parseInteger(body.compareAt, 'Compare-at price', { min: 1, allowNull: true });
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
    sizes: cleanStringList(body.sizes, 'Sizes', 12, 12),
    colors: cleanStringList(body.colors, 'Colours', 10, 30),
    active: body.active === false || body.active === 0 ? 0 : 1,
    sortOrder: parseInteger(body.sortOrder ?? 0, 'Sort order', { min: 0, max: 100000 }),
    stock: body.stock && typeof body.stock === 'object' ? body.stock : {}
  };
}

export async function saveProductRecord(db, id, p) {
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
    const stock = raw === null || raw === '' || raw === undefined ? null : parseInteger(raw, 'Stock', { min: 0, max: 100000 });
    statements.push(
      db
        .prepare('INSERT INTO variants (product_id, size, color, stock) VALUES (?, ?, ?, ?) ON CONFLICT(product_id, size, color) DO UPDATE SET stock = excluded.stock')
        .bind(id, size, color, stock)
    );
  });
  if (statements.length) await db.batch(statements);
  return id;
}

export async function uploadProductImage({ request, env }) {
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > 1_000_000) throw new HttpError(413, 'Image must be under 1 MB.');
  const b = new Uint8Array(buffer);
  const mime =
    b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0x52 && b[8] === 0x57 ? 'image/webp' : null;
  if (!mime) throw new HttpError(415, 'Only JPEG, PNG or WebP images are allowed.');
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  await env.DB.prepare('INSERT INTO images (mime, data_b64) VALUES (?, ?)').bind(mime, btoa(bin)).run();
  const row = await env.DB.prepare('SELECT MAX(id) AS id FROM images').first();
  return json({ url: `/api/images/${row.id}` }, 201);
}

export async function listOrders({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = (url.searchParams.get('q') || '').trim();
  const where = [];
  const binds = [];
  if (status && ORDER_STATUSES.includes(status)) { where.push('o.status = ?'); binds.push(status); }
  if (q) { where.push('(o.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await env.DB
    .prepare(`SELECT o.*, c.name AS customer_name, c.phone AS customer_phone FROM orders o JOIN customers c ON c.id = o.customer_id ${clause} ORDER BY o.id DESC LIMIT 100`)
    .bind(...binds)
    .all();
  return json({ orders: rows.results });
}

export async function getOrderDetail({ env }, id) {
  const order = await env.DB
    .prepare(`SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`)
    .bind(id)
    .first();
  if (!order) throw new HttpError(404, 'Order not found.');
  const items = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all();
  return json({ order, items: items.results });
}

export async function updateOrderStatus({ request, env }, id) {
  const body = await readJson(request);
  const order = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw new HttpError(404, 'Order not found.');
  const statements = [];
  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status.');
    if (order.status === 'cancelled' && body.status !== 'cancelled') throw new HttpError(409, 'A cancelled order cannot be reopened.');
    if (body.status === 'cancelled' && order.status !== 'cancelled') {
      const items = await env.DB.prepare('SELECT product_id, size, color, qty FROM order_items WHERE order_id = ?').bind(id).all();
      items.results.forEach((i) =>
        statements.push(env.DB.prepare('UPDATE variants SET stock = stock + ? WHERE product_id = ? AND size = ? AND color = ? AND stock IS NOT NULL').bind(i.qty, i.product_id, i.size, i.color))
      );
    }
    statements.push(env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(body.status, id));
  }
  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus)) throw new HttpError(400, 'Invalid payment status.');
    statements.push(env.DB.prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").bind(body.paymentStatus, id));
  }
  await env.DB.batch(statements);
  return getOrderDetail({ env }, id);
}

export function validatePromoPayload(body, requireCode = true) {
  const out = {};
  if (requireCode) {
    out.code = cleanText(body.code, 3, 20, 'Code').toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(out.code)) throw new HttpError(400, 'Code may only contain letters, numbers, - and _.');
  }
  out.percent = parseInteger(body.percent, 'Percent', { min: 1, max: 90 });
  out.active = body.active === false || body.active === 0 ? 0 : 1;
  out.minSubtotal = parseInteger(body.minSubtotal ?? 0, 'Minimum order', { min: 0 });
  out.maxUses = parseInteger(body.maxUses, 'Max uses', { min: 1, allowNull: true });
  out.expiresAt = body.expiresAt ? `${body.expiresAt} 23:59:59` : null;
  return out;
}

export function validateSettingsPayload(body) {
  const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
  if (whatsapp.length < 8 || whatsapp.length > 15) throw new HttpError(400, 'WhatsApp number must be digits with country code.');
  const guide = Array.isArray(body.sizeGuide) ? body.sizeGuide : [];
  if (guide.length < 2 || guide.length > 10) throw new HttpError(400, 'Size guide needs between 2 and 10 sizes.');
  let prev = 0;
  const sizeGuide = guide.map((row, i) => {
    const size = cleanText(row.size, 1, 8, 'Size');
    if (i === guide.length - 1) return { size, below: null };
    const below = Number(row.below);
    if (!Number.isFinite(below) || below <= prev || below > 400) throw new HttpError(400, 'Weight limits must increase.');
    prev = below;
    return { size, below };
  });
  return {
    whatsapp,
    shippingFee: parseInteger(body.shippingFee, 'Shipping fee', { min: 0, max: 10000 }),
    freeShippingThreshold: parseInteger(body.freeShippingThreshold, 'Free-shipping threshold', { min: 0, max: 1_000_000 }),
    sizeGuide,
    tallCm: parseInteger(body.tallCm, 'Tall height (cm)', { min: 150, max: 230 }),
    shortCm: parseInteger(body.shortCm, 'Short height (cm)', { min: 120, max: 200 }),
    welcomePromo: body.welcomePromo ? cleanText(body.welcomePromo, 3, 20, 'Welcome code').toUpperCase() : ''
  };
}
