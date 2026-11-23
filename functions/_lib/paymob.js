// Paymob (Accept) integration. Enabled only when all four secrets are configured.
// NOTE: this code follows Paymob's documented Accept flow but can only be verified
// with real merchant credentials - see README "Payments".
import { hmacHex, safeEqual } from './util.js';

const BASE = 'https://accept.paymob.com/api';

export function paymobEnabled(env) {
  return !!(env.PAYMOB_API_KEY && env.PAYMOB_INTEGRATION_ID && env.PAYMOB_IFRAME_ID && env.PAYMOB_HMAC_SECRET);
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Paymob ${path} failed (${res.status})`);
  return data;
}

export async function createPaymobPayment(env, order, customer, items) {
  const amountCents = order.total * 100;
  const auth = await post('/auth/tokens', { api_key: env.PAYMOB_API_KEY });
  const registered = await post('/ecommerce/orders', {
    auth_token: auth.token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    merchant_order_id: order.code,
    items: items.map((i) => ({
      name: `${i.name} (${i.size})`.slice(0, 50),
      amount_cents: i.unit_price * 100,
      description: i.sku,
      quantity: i.qty
    }))
  });
  const [first, ...rest] = customer.name.split(' ');
  const key = await post('/acceptance/payment_keys', {
    auth_token: auth.token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: registered.id,
    currency: 'EGP',
    integration_id: Number(env.PAYMOB_INTEGRATION_ID),
    billing_data: {
      first_name: first || 'NA',
      last_name: rest.join(' ') || 'NA',
      email: customer.email || 'NA',
      phone_number: customer.phone,
      apartment: 'NA',
      floor: 'NA',
      building: 'NA',
      street: order.address.slice(0, 100),
      shipping_method: 'NA',
      postal_code: 'NA',
      city: order.governorate,
      country: 'EG',
      state: order.governorate
    }
  });
  return {
    paymobOrderId: String(registered.id),
    url: `${BASE}/acceptance/iframes/${env.PAYMOB_IFRAME_ID}?payment_token=${key.token}`
  };
}

// Field order is defined by Paymob for the "transaction processed" callback.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
  'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success'
];

function pick(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

export async function verifyPaymobHmac(env, obj, receivedHmac) {
  if (!env.PAYMOB_HMAC_SECRET || !receivedHmac || !obj) return false;
  const joined = HMAC_FIELDS.map((f) => {
    const v = pick(obj, f);
    return v === undefined || v === null ? '' : String(v);
  }).join('');
  const expected = await hmacHex(env.PAYMOB_HMAC_SECRET, joined, 'SHA-512');
  return safeEqual(expected, String(receivedHmac).toLowerCase());
}
