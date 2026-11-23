// Admin Route Dispatcher (delegates to admin-auth.js and admin-catalog.js).
import { HttpError, json, readJson, getSettings, saveSettings, loadCatalog } from './util.js';
import {
  ensureAdminConfigured, isAuthed, buildCookieHeader, loginAdmin, getAdminStats, listCustomers, listSubscribers
} from './admin-auth.js';
import {
  validateProductPayload, saveProductRecord, uploadProductImage, listOrders, getOrderDetail,
  updateOrderStatus, validatePromoPayload, validateSettingsPayload
} from './admin-catalog.js';

export async function handleAdmin(context, segs) {
  const { request, env } = context;
  const method = request.method;
  const [resource, param] = segs;

  if (resource === 'login' && method === 'POST') return loginAdmin(context);
  ensureAdminConfigured(env);
  if (resource === 'me' && method === 'GET') return json({ authed: await isAuthed(request, env) });
  if (resource === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': buildCookieHeader('', 0, request) });
  }
  if (!(await isAuthed(request, env))) throw new HttpError(401, 'Please sign in.');

  const id = param !== undefined ? Number(param) : null;
  const idOk = id !== null && Number.isInteger(id) && id > 0;

  if (resource === 'stats' && method === 'GET') return getAdminStats(context);
  if (resource === 'customers' && method === 'GET') return listCustomers(context);
  if (resource === 'subscribers' && method === 'GET') return listSubscribers(context);
  if (resource === 'upload' && method === 'POST') return uploadProductImage(context);

  if (resource === 'products') {
    if (method === 'GET' && param === undefined) return json({ products: await loadCatalog(env.DB, { includeInactive: true }) });
    if (method === 'POST' && param === undefined) {
      const newId = await saveProductRecord(env.DB, null, validateProductPayload(await readJson(request)));
      return json({ id: newId }, 201);
    }
    if (method === 'PUT' && idOk) {
      await saveProductRecord(env.DB, id, validateProductPayload(await readJson(request)));
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

  if (resource === 'orders') {
    if (method === 'GET' && param === undefined) return listOrders(context);
    if (method === 'GET' && idOk) return getOrderDetail(context, id);
    if (method === 'PATCH' && idOk) return updateOrderStatus(context, id);
  }

  if (resource === 'promos') {
    if (method === 'GET') return json({ promos: (await env.DB.prepare('SELECT * FROM promo_codes ORDER BY code').all()).results });
    if (method === 'POST') {
      const p = validatePromoPayload(await readJson(request));
      await env.DB
        .prepare('INSERT INTO promo_codes (code, percent, active, min_subtotal, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(p.code, p.percent, p.active, p.minSubtotal, p.maxUses, p.expiresAt)
        .run();
      return json({ ok: true }, 201);
    }
    if (method === 'PUT' && param) {
      const p = validatePromoPayload(await readJson(request), false);
      await env.DB
        .prepare('UPDATE promo_codes SET percent=?, active=?, min_subtotal=?, max_uses=?, expires_at=? WHERE code=?')
        .bind(p.percent, p.active, p.minSubtotal, p.maxUses, p.expiresAt, String(param).toUpperCase())
        .run();
      return json({ ok: true });
    }
    if (method === 'DELETE' && param) {
      await env.DB.prepare('DELETE FROM promo_codes WHERE code = ?').bind(String(param).toUpperCase()).run();
      return json({ ok: true });
    }
  }

  if (resource === 'settings') {
    if (method === 'GET') return json({ settings: await getSettings(env.DB) });
    if (method === 'PUT') {
      await saveSettings(env.DB, validateSettingsPayload(await readJson(request)));
      return json({ settings: await getSettings(env.DB) });
    }
  }

  throw new HttpError(404, 'Not found');
}
