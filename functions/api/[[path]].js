// Single entry point for every /api/* route (Cloudflare Pages Functions catch-all).
import { HttpError, json } from '../_lib/util.js';
import {
  getConfig, getProducts, checkPromo, createOrder, subscribeNewsletter, getImage, paymobWebhook, paymobReturn
} from '../_lib/public.js';
import { handleAdmin } from '../_lib/admin.js';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const segs = Array.isArray(context.params.path) ? context.params.path : [context.params.path].filter(Boolean);
  const method = request.method;
  const route = segs.join('/');

  try {
    if (!env.DB) throw new HttpError(503, 'Database is not configured.');

    // CSRF / cross-site protection for state-changing calls (Paymob webhook is server-to-server).
    const isWebhook = route === 'payments/paymob/webhook';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !isWebhook) {
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) throw new HttpError(403, 'Cross-site request blocked.');
    }

    let response;
    if (route === 'config' && method === 'GET') response = await getConfig(context);
    else if (route === 'products' && method === 'GET') response = await getProducts(context);
    else if (route === 'promo' && method === 'POST') response = await checkPromo(context);
    else if (route === 'orders' && method === 'POST') response = await createOrder(context);
    else if (route === 'newsletter' && method === 'POST') response = await subscribeNewsletter(context);
    else if (segs[0] === 'images' && segs.length === 2 && method === 'GET') response = await getImage(context, segs[1]);
    else if (route === 'payments/paymob/webhook' && method === 'POST') response = await paymobWebhook(context);
    else if (route === 'payments/paymob/return' && method === 'GET') response = paymobReturn(context);
    else if (segs[0] === 'admin') response = await handleAdmin(context, segs.slice(1));
    else throw new HttpError(404, 'Not found');

    const out = new Response(response.body, response);
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status, SECURITY_HEADERS);
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500, SECURITY_HEADERS);
  }
}
