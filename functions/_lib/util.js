// Shared helpers for the Gym Gang API (Cloudflare Pages Functions + D1).

export const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Red Sea', 'Beheira', 'Fayoum', 'Gharbia',
  'Ismailia', 'Menofia', 'Minya', 'Qalyubia', 'New Valley', 'Suez', 'Aswan', 'Assiut',
  'Beni Suef', 'Port Said', 'Damietta', 'Sharqia', 'South Sinai', 'Kafr El Sheikh',
  'Matrouh', 'Luxor', 'Qena', 'North Sinai', 'Sohag'
];

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export async function readJson(request, maxBytes = 64 * 1024) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected application/json');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== 'object') throw new Error('bad');
    return data;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

export async function rateLimit(db, key, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || now - row.window_start >= windowSec) {
    await db
      .prepare(
        'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ' +
          'ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1'
      )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

const enc = new TextEncoder();

export function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacHex(secret, data, hash = 'SHA-256') {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// Constant-time string comparison.
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b)))
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function normalizePhone(raw) {
  let p = String(raw || '').replace(/[\s\-().]/g, '');
  if (p.startsWith('+20')) p = `0${p.slice(3)}`;
  else if (p.startsWith('0020')) p = `0${p.slice(4)}`;
  else if (/^20\d{10}$/.test(p)) p = `0${p.slice(2)}`;
  return /^01[0125]\d{8}$/.test(p) ? p : null;
}

export function isEmail(value) {
  return typeof value === 'string' && value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function cleanText(value, min, max, label) {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < min) throw new HttpError(400, `${label} is too short`);
  if (text.length > max) throw new HttpError(400, `${label} is too long`);
  return text;
}

export function randomChars(n) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export const formatEGP = (n) => `${Number(n).toLocaleString('en-US')} EGP`;

export const DEFAULT_SIZE_GUIDE = [
  { size: 'S', below: 65 },
  { size: 'M', below: 78 },
  { size: 'L', below: 92 },
  { size: 'XL', below: null }
];

export const DEFAULT_SETTINGS = {
  whatsapp: '201010565783',
  shippingFee: 60,
  freeShippingThreshold: 1500,
  sizeGuide: DEFAULT_SIZE_GUIDE,
  tallCm: 186,
  shortCm: 165,
  welcomePromo: 'GANG10'
};

const SETTING_KEYS = {
  whatsapp: 'whatsapp',
  shippingFee: 'shipping_fee',
  freeShippingThreshold: 'free_shipping_threshold',
  sizeGuide: 'size_guide',
  tallCm: 'tall_cm',
  shortCm: 'short_cm',
  welcomePromo: 'welcome_promo'
};

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const raw = Object.fromEntries(results.map((r) => [r.key, r.value]));
  const num = (k, d) => (raw[k] !== undefined && Number.isFinite(Number(raw[k])) ? Number(raw[k]) : d);
  let sizeGuide = DEFAULT_SIZE_GUIDE;
  try {
    const parsed = JSON.parse(raw.size_guide || 'null');
    if (Array.isArray(parsed) && parsed.length) sizeGuide = parsed;
  } catch {
    // keep default
  }
  return {
    whatsapp: raw.whatsapp || DEFAULT_SETTINGS.whatsapp,
    shippingFee: num('shipping_fee', DEFAULT_SETTINGS.shippingFee),
    freeShippingThreshold: num('free_shipping_threshold', DEFAULT_SETTINGS.freeShippingThreshold),
    sizeGuide,
    tallCm: num('tall_cm', DEFAULT_SETTINGS.tallCm),
    shortCm: num('short_cm', DEFAULT_SETTINGS.shortCm),
    welcomePromo: raw.welcome_promo || ''
  };
}

export async function saveSettings(db, settings) {
  const statements = Object.entries(SETTING_KEYS).map(([prop, key]) => {
    const value = prop === 'sizeGuide' ? JSON.stringify(settings[prop]) : String(settings[prop] ?? '');
    return db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(key, value);
  });
  await db.batch(statements);
}

export function parseJsonArray(text) {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function shapeProduct(row, variants) {
  const stock = {};
  variants.filter((v) => v.product_id === row.id).forEach((v) => {
    stock[`${v.size}|${v.color}`] = v.stock;
  });
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    compareAt: row.compare_at,
    summary: row.summary,
    specs: parseJsonArray(row.specs),
    image: row.image,
    sizes: parseJsonArray(row.sizes),
    colors: parseJsonArray(row.colors),
    active: !!row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    sold: row.sold || 0,
    stock
  };
}

export async function loadCatalog(db, { includeInactive = false } = {}) {
  const products = await db
    .prepare(
      `SELECT p.*, (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id AND o.status != 'cancelled') AS sold
       FROM products p ${includeInactive ? '' : 'WHERE p.active = 1'}
       ORDER BY p.sort_order, p.id`
    )
    .all();
  const variants = await db.prepare('SELECT product_id, size, color, stock FROM variants').all();
  return products.results.map((row) => shapeProduct(row, variants.results));
}
