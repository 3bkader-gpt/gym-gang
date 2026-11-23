// Public (customer-facing) API handlers.
import {
  GOVERNORATES, HttpError, json, readJson, clientIp, rateLimit, normalizePhone, isEmail,
  cleanText, randomChars, formatEGP, getSettings, loadCatalog
} from './util.js';
import { paymobEnabled, createPaymobPayment, verifyPaymobHmac } from './paymob.js';

const PAYMENT_METHODS = { cod: 'Cash on delivery', transfer: 'InstaPay / Vodafone Cash', paymob: 'Card / wallet (Paymob)' };

export async function getConfig({ env }) {
  const s = await getSettings(env.DB);
  return json(
    {
      whatsapp: s.whatsapp,
      shippingFee: s.shippingFee,
      freeShippingThreshold: s.freeShippingThreshold,
      sizeGuide: s.sizeGuide,
      tallCm: s.tallCm,
      shortCm: s.shortCm,
      governorates: GOVERNORATES,
      paymentMethods: { cod: true, transfer: true, paymob: paymobEnabled(env) },
      welcomePromo: s.welcomePromo
    },
    200,
    { 'cache-control': 'no-cache' }
  );
}

export async function getProducts({ env }) {
  const products = await loadCatalog(env.DB);
  return json({ products }, 200, { 'cache-control': 'no-cache' });
}

async function findPromo(db, code, subtotal) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const promo = await db.prepare('SELECT * FROM promo_codes WHERE code = ?').bind(clean).first();
  if (!promo || !promo.active) throw new HttpError(400, 'That code is not valid.');
  if (promo.expires_at && new Date(promo.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    throw new HttpError(400, 'That code has expired.');
  }
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    throw new HttpError(400, 'That code has reached its usage limit.');
  }
  if (subtotal < promo.min_subtotal) {
    throw new HttpError(400, `That code needs a minimum order of ${formatEGP(promo.min_subtotal)}.`);
  }
  return promo;
}

export async function checkPromo({ request, env }) {
  const body = await readJson(request);
  const subtotal = Math.max(0, Math.floor(Number(body.subtotal) || 0));
  const promo = await findPromo(env.DB, body.code, subtotal);
  if (!promo) throw new HttpError(400, 'Enter a code first.');
  return json({ valid: true, code: promo.code, percent: promo.percent });
}

function etaRange() {
  const fmt = (days) => {
    const d = new Date(Date.now() + days * 86400000);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' });
  };
  return `${fmt(2)} to ${fmt(4)}`;
}

export async function createOrder({ request, env }) {
  const db = env.DB;
  const ip = clientIp(request);
  if (!(await rateLimit(db, `order:${ip}`, 8, 3600))) {
    throw new HttpError(429, 'Too many orders from this connection. Please try again later or message us on WhatsApp.');
  }

  const body = await readJson(request);
  if (body.website) throw new HttpError(400, 'Invalid request'); // honeypot

  // ---- validate customer input ----
  const name = cleanText(body.customer?.name, 2, 80, 'Name');
  const phone = normalizePhone(body.customer?.phone);
  if (!phone) throw new HttpError(400, 'Enter a valid Egyptian mobile number (e.g. 01012345678).');
  let email = null;
  if (body.customer?.email) {
    email = String(body.customer.email).trim().toLowerCase();
    if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email or leave it empty.');
  }
  const governorate = String(body.governorate || '');
  if (!GOVERNORATES.includes(governorate)) throw new HttpError(400, 'Choose a governorate.');
  const address = cleanText(body.address, 8, 300, 'Address');
  const notes = body.notes ? cleanText(body.notes, 0, 300, 'Notes') : null;

  const methodKey = String(body.paymentMethod || '');
  if (!PAYMENT_METHODS[methodKey]) throw new HttpError(400, 'Choose a payment method.');
  if (methodKey === 'paymob' && !paymobEnabled(env)) throw new HttpError(400, 'Online payment is not available yet.');

  // ---- validate items against the database (never trust client prices) ----
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length || rawItems.length > 30) throw new HttpError(400, 'Your bag is empty.');

  const catalog = await loadCatalog(db);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const lines = new Map();
  for (const item of rawItems) {
    const product = byId.get(Number(item.productId));
    if (!product) throw new HttpError(400, 'One of the pieces is no longer available.');
    const size = String(item.size || '');
    const color = String(item.color || product.colors[0] || '');
    if (!product.sizes.includes(size) || (product.colors.length && !product.colors.includes(color))) {
      throw new HttpError(400, `${product.name}: choose a valid size and colour.`);
    }
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'Invalid quantity.');
    const key = `${product.id}|${size}|${color}`;
    const line = lines.get(key) || { product, size, color, qty: 0 };
    line.qty += qty;
    lines.set(key, line);
  }

  const items = [...lines.values()];
  for (const line of items) {
    const stock = line.product.stock[`${line.size}|${line.color}`];
    if (stock !== null && stock !== undefined && line.qty > stock) {
      throw new HttpError(409, stock === 0
        ? `${line.product.name} (${line.size}) just sold out.`
        : `Only ${stock} left of ${line.product.name} (${line.size}).`);
    }
  }

  const settings = await getSettings(db);
  const subtotal = items.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const promo = body.promoCode ? await findPromo(db, body.promoCode, subtotal) : null;
  const discount = promo ? Math.round((subtotal * promo.percent) / 100) : 0;
  const shipping = subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  const total = subtotal - discount + shipping;

  // ---- write everything in one atomic batch ----
  let code = '';
  let saved = false;
  for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
    code = `GG-${Date.now().toString(36).toUpperCase().slice(-5)}${randomChars(3)}`;
    const statements = [
      db
        .prepare(
          'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?) ' +
            'ON CONFLICT(phone) DO UPDATE SET name = excluded.name, email = COALESCE(excluded.email, customers.email)'
        )
        .bind(name, phone, email),
      db
        .prepare(
          `INSERT INTO orders (code, customer_id, payment_method, subtotal, discount, shipping, total,
                               promo_code, governorate, address, notes)
           VALUES (?, (SELECT id FROM customers WHERE phone = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(code, phone, methodKey, subtotal, discount, shipping, total, promo ? promo.code : null, governorate, address, notes)
    ];
    for (const l of items) {
      statements.push(
        db
          .prepare(
            `INSERT INTO order_items (order_id, product_id, name, sku, size, color, unit_price, qty)
             VALUES ((SELECT id FROM orders WHERE code = ?), ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(code, l.product.id, l.product.name, l.product.sku, l.size, l.color, l.product.price, l.qty),
        // CHECK (stock >= 0) makes the whole batch roll back if stock ran out in the meantime.
        db
          .prepare('UPDATE variants SET stock = stock - ? WHERE product_id = ? AND size = ? AND color = ? AND stock IS NOT NULL')
          .bind(l.qty, l.product.id, l.size, l.color)
      );
    }
    if (promo) statements.push(db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?').bind(promo.code));

    try {
      await db.batch(statements);
      saved = true;
    } catch (err) {
      const msg = String(err?.message || err);
      if (/orders\.code/i.test(msg) || /UNIQUE constraint failed: orders/i.test(msg)) continue; // code collision, retry
      if (/CHECK constraint failed/i.test(msg)) throw new HttpError(409, 'Sorry, one of the pieces just sold out. Please refresh your bag.');
      throw err;
    }
  }
  if (!saved) throw new HttpError(500, 'Could not create the order. Please try again.');

  // ---- build the WhatsApp text ----
  const lines_ = [
    `New Gym Gang order ${code}`,
    ...items.map((l) => `- ${l.product.name} (${l.product.sku}, Size ${l.size}${l.color ? `, ${l.color}` : ''}) x${l.qty} = ${formatEGP(l.product.price * l.qty)}`),
    ...(discount ? [`Promo ${promo.code}: -${formatEGP(discount)}`] : []),
    `Delivery: ${shipping ? formatEGP(shipping) : 'Free'}`,
    `Total: ${formatEGP(total)}`,
    `Payment: ${PAYMENT_METHODS[methodKey]}`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Governorate: ${governorate}`,
    `Address: ${address}`,
    ...(notes ? [`Notes: ${notes}`] : []),
    `Estimated delivery: ${etaRange()}`
  ];

  const response = {
    order: { code, subtotal, discount, shipping, total, paymentMethod: methodKey, eta: etaRange() },
    whatsapp: { number: settings.whatsapp, text: lines_.join('\n') }
  };

  // ---- optional online payment ----
  if (methodKey === 'paymob') {
    try {
      const orderRow = { code, total, address, governorate };
      const dbItems = items.map((l) => ({ name: l.product.name, sku: l.product.sku, size: l.size, unit_price: l.product.price, qty: l.qty }));
      const pay = await createPaymobPayment(env, orderRow, { name, phone, email }, dbItems);
      await db.prepare('UPDATE orders SET paymob_order_id = ? WHERE code = ?').bind(pay.paymobOrderId, code).run();
      response.paymentUrl = pay.url;
    } catch (err) {
      console.error('Paymob init failed', err);
      response.paymentError = 'Online payment could not be started. Your order is saved; we will contact you on WhatsApp to complete it.';
    }
  }

  return json(response, 201);
}

export async function subscribeNewsletter({ request, env }) {
  const ip = clientIp(request);
  if (!(await rateLimit(env.DB, `news:${ip}`, 6, 3600))) throw new HttpError(429, 'Too many attempts. Please try again later.');
  const body = await readJson(request);
  if (body.website) throw new HttpError(400, 'Invalid request');
  const email = String(body.email || '').trim().toLowerCase();
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');

  const result = await env.DB.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').bind(email).run();
  const alreadySubscribed = (result.meta?.changes ?? 0) === 0;

  const settings = await getSettings(env.DB);
  let promoCode = null;
  if (settings.welcomePromo) {
    const p = await env.DB.prepare('SELECT code FROM promo_codes WHERE code = ? AND active = 1').bind(settings.welcomePromo).first();
    promoCode = p ? p.code : null;
  }

  let emailSent = false;
  if (!alreadySubscribed && env.RESEND_API_KEY && env.MAIL_FROM) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [email],
          subject: 'You’re in the gang',
          text: `Welcome to Gym Gang.${promoCode ? ` Use code ${promoCode} for 10% off your first order.` : ''}\n\nDiscipline. Consistency. Community.`
        })
      });
      emailSent = res.ok;
    } catch (err) {
      console.error('Resend failed', err);
    }
  }

  return json({ ok: true, alreadySubscribed, promoCode, emailSent });
}

export async function getImage({ env }, id) {
  const row = await env.DB.prepare('SELECT mime, data_b64 FROM images WHERE id = ?').bind(Number(id)).first();
  if (!row) throw new HttpError(404, 'Not found');
  const bin = atob(row.data_b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' }
  });
}

// ---- Paymob webhooks ----
export async function paymobWebhook({ request, env }) {
  const url = new URL(request.url);
  let payload;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, 'Bad payload');
  }
  const obj = payload?.obj;
  if (!(await verifyPaymobHmac(env, obj, url.searchParams.get('hmac')))) throw new HttpError(401, 'Invalid signature');

  const code = obj?.order?.merchant_order_id;
  const order = code ? await env.DB.prepare('SELECT id, total, payment_status FROM orders WHERE code = ?').bind(code).first() : null;
  if (!order) return json({ ok: true }); // acknowledge unknown orders so Paymob stops retrying
  if (Number(obj.amount_cents) !== order.total * 100) {
    console.error('Paymob amount mismatch for', code);
    return json({ ok: true });
  }
  const success = obj.success === true && obj.pending !== true;
  if (order.payment_status !== 'paid') {
    await env.DB
      .prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(success ? 'paid' : 'failed', order.id)
      .run();
  }
  return json({ ok: true });
}

// The browser redirect after paying: informational only (the webhook is the source of truth).
export function paymobReturn({ request }) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('merchant_order_id') || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 20);
  const target = new URL('/', url.origin);
  if (code) {
    target.searchParams.set('order', code);
    target.searchParams.set('payment', url.searchParams.get('success') === 'true' ? 'success' : 'failed');
  }
  return Response.redirect(target.toString(), 302);
}
