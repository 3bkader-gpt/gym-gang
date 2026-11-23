// Admin Authentication, Session Cookie Verification & Analytics KPIs.
import { HttpError, json, readJson, clientIp, rateLimit, hmacHex, safeEqual } from './util.js';

const COOKIE_NAME = 'gg_admin';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export function ensureAdminConfigured(env) {
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

async function createSessionToken(env, expiresAtMs) {
  const secret = String(env.SESSION_SECRET).trim();
  return `${expiresAtMs}.${await hmacHex(secret, `admin.${expiresAtMs}`)}`;
}

export async function isAuthed(request, env) {
  if (!env.SESSION_SECRET) return false;
  const [exp, sig] = readCookie(request, COOKIE_NAME).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const secret = String(env.SESSION_SECRET).trim();
  return safeEqual(sig, await hmacHex(secret, `admin.${exp}`));
}

export function buildCookieHeader(value, maxAgeSec, request) {
  const isHttps = new URL(request.url).protocol === 'https:';
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${isHttps ? '; Secure' : ''}`;
}

export async function loginAdmin({ request, env }) {
  ensureAdminConfigured(env);
  const ip = clientIp(request);
  if (!(await rateLimit(env.DB, `login:${ip}`, 6, 900))) {
    throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
  }
  const body = await readJson(request, 2048);
  const ok = await safeEqual(String(body.password || '').trim(), String(env.ADMIN_PASSWORD).trim());
  if (!ok) throw new HttpError(401, 'Wrong password.');
  const token = await createSessionToken(env, Date.now() + SESSION_DURATION_MS);
  return json({ ok: true }, 200, { 'set-cookie': buildCookieHeader(token, SESSION_DURATION_MS / 1000, request) });
}

export async function getAdminStats({ env }) {
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
  const topProducts = await db
    .prepare(
      `SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
       GROUP BY oi.product_id ORDER BY qty DESC LIMIT 5`
    )
    .all();
  const lowStock = await db
    .prepare(
      `SELECT p.name, v.size, v.color, v.stock FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.stock IS NOT NULL AND v.stock <= 3 AND p.active = 1 ORDER BY v.stock, p.name LIMIT 20`
    )
    .all();
  const counts = await db
    .prepare(
      'SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM subscribers) AS subscribers, (SELECT COUNT(*) FROM products WHERE active = 1) AS products'
    )
    .first();
  const nonCancelled = totals.orders - (byStatus.results.find((s) => s.status === 'cancelled')?.n || 0);
  return json({
    totals: { ...totals, avgOrder: nonCancelled ? Math.round(totals.revenue / nonCancelled) : 0 },
    byStatus: byStatus.results,
    daily: daily.results,
    topProducts: topProducts.results,
    lowStock: lowStock.results,
    counts
  });
}

export async function listCustomers({ env }) {
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

export async function listSubscribers({ env }) {
  const rows = await env.DB.prepare('SELECT email, created_at FROM subscribers ORDER BY id DESC LIMIT 1000').all();
  return json({ subscribers: rows.results });
}
