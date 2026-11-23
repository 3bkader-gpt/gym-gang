# Gym Gang — Full-Stack Storefront & Admin

Full-stack e-commerce storefront for **Gym Gang (Drop 01)** built with **Cloudflare Pages Functions** and **Cloudflare D1 (SQLite)**.

- **Live Storefront:** https://gym-gang.pages.dev/
- **Admin Dashboard:** https://gym-gang.pages.dev/admin.html

---

## Architecture

```text
gym-gang/
├── public/                 # Static frontend assets deployed by Cloudflare Pages
│   ├── index.html          # Customer storefront (Catalog, Gear Lab, Bag, Legal modals)
│   ├── admin.html          # Protected Admin Dashboard
│   ├── css/                # Design tokens, base, and storefront stylesheets
│   ├── js/                 # products.js, store.js, gear-lab.js, admin.js
│   └── assets/             # Product studio photography, transparent logo, OG & favicon
├── functions/              # Cloudflare Pages Functions backend (/api/*)
│   ├── api/[[path]].js     # Catch-all API router with CSRF & security headers
│   └── _lib/               # util.js, public.js, admin.js, paymob.js
├── migrations/             # D1 SQLite schema & initial Drop 01 seed data
│   ├── 0001_init.sql
│   └── 0002_seed.sql
├── scripts/make_seed.py    # Idempotent seed SQL generator
├── wrangler.toml           # Cloudflare Pages + D1 binding configuration
└── .env.example            # Environment variable template (no secrets)
```

---

## Local Setup & Development

1. **Create `.dev.vars` from `.env.example`:**
   ```bash
   cp .env.example .dev.vars
   ```
   Edit `.dev.vars` and set `ADMIN_PASSWORD` and `SESSION_SECRET`.

2. **Initialize and seed the local D1 database:**
   ```bash
   wrangler d1 execute gym-gang-db --local --file=migrations/0001_init.sql
   wrangler d1 execute gym-gang-db --local --file=migrations/0002_seed.sql
   ```

3. **Start the local full-stack server:**
   ```bash
   wrangler pages dev ./public
   ```

---

## Production Deployment (Cloudflare Pages + D1)

1. **Apply migrations to the remote D1 database:**
   ```bash
   wrangler d1 execute gym-gang-db --remote --file=migrations/0001_init.sql
   wrangler d1 execute gym-gang-db --remote --file=migrations/0002_seed.sql
   ```

2. **Configure production secrets (stored securely in Cloudflare, never in Git):**
   ```bash
   wrangler pages secret put ADMIN_PASSWORD --project-name=gym-gang
   wrangler pages secret put SESSION_SECRET --project-name=gym-gang
   ```

3. **Deploy to Cloudflare Pages:**
   ```bash
   wrangler pages deploy ./public --project-name=gym-gang --branch=main
   ```

---

## Payments (Cash on Delivery, InstaPay/Vodafone Cash, Paymob Egypt)

- **Cash on Delivery (`cod`)** and **InstaPay / Vodafone Cash (`transfer`)** work out of the box. Every order is validated on the server against D1 product prices, stock levels, and promo codes, saved in `orders` + `order_items`, and formatted into a WhatsApp confirmation message.
- **Paymob Accept (`paymob`)**:
  To enable online Card / Mobile Wallet payments in Egypt, set the four Paymob secrets in Cloudflare Pages:
  ```bash
  wrangler pages secret put PAYMOB_API_KEY --project-name=gym-gang
  wrangler pages secret put PAYMOB_INTEGRATION_ID --project-name=gym-gang
  wrangler pages secret put PAYMOB_IFRAME_ID --project-name=gym-gang
  wrangler pages secret put PAYMOB_HMAC_SECRET --project-name=gym-gang
  ```
  Configure your Paymob Accept integration callbacks:
  - **Transaction Processed Callback (POST):** `https://gym-gang.pages.dev/api/payments/paymob/webhook`
  - **Transaction Response Callback (GET):** `https://gym-gang.pages.dev/api/payments/paymob/return`

  Once all four variables are set, `/api/config` automatically exposes `paymentMethods.paymob = true` and the checkout drawer displays the **Card / Mobile Wallet (Paymob)** option.

---

## WhatsApp & Size Guide Configuration

Sign in to `/admin.html` -> **Settings & Size Guide** to update:
- **WhatsApp Order Number** (with country code, e.g. `201010565783`)
- **Flat Shipping Fee & Free-Shipping Threshold**
- **Newsletter Welcome Promo Code** (default `GANG10`)
- **Size Guide Weight Brackets & Height Thresholds**
