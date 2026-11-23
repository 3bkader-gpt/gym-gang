(function () {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => `${Number(n || 0).toLocaleString('en-US')} EGP`;
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let catalog = [];
  let currentStockMap = {};
  let toastTimer = null;

  function toast(msg) {
    const t = $('adm-toast');
    t.textContent = msg;
    t.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-open'), 2400);
  }

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    let body = opts.body;
    if (body && !(body instanceof ArrayBuffer) && typeof body === 'object') {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(`/api/admin/${path}`, {
      method: opts.method || 'GET',
      headers,
      body,
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function showApp(authed) {
    $('login-view').hidden = authed;
    $('app-view').hidden = !authed;
    $('adm-tabs').hidden = !authed;
    if (authed) loadAll();
  }

  async function loadAll() {
    await Promise.all([loadStats(), loadOrders(), loadProducts(), loadPromos(), loadCustomers(), loadSettings()]);
  }

  async function loadStats() {
    const d = await api('stats');
    $('kpi-grid').innerHTML = `
      <div class="kpi"><small>Total Revenue</small><strong>${fmt(d.totals.revenue)}</strong></div>
      <div class="kpi"><small>Paid Revenue</small><strong>${fmt(d.totals.paid_revenue)}</strong></div>
      <div class="kpi"><small>Total Orders</small><strong>${d.totals.orders}</strong></div>
      <div class="kpi"><small>New Orders</small><strong>${d.totals.new_orders}</strong></div>
      <div class="kpi"><small>Avg Order Value</small><strong>${fmt(d.totals.avgOrder)}</strong></div>
      <div class="kpi"><small>Customers / Leads</small><strong>${d.counts.customers} / ${d.counts.subscribers}</strong></div>
    `;
    $('top-products-tb').innerHTML = d.topProducts.length
      ? d.topProducts.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${fmt(p.revenue)}</td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--ink-dim)">No sales recorded yet.</td></tr>';
    $('low-stock-tb').innerHTML = d.lowStock.length
      ? d.lowStock.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.size)} / ${esc(v.color)}</td><td><span class="badge">${v.stock}</span></td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--ink-dim)">No low-stock variants.</td></tr>';
  }

  async function loadOrders() {
    const q = $('ord-q').value.trim();
    const status = $('ord-status').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    const d = await api(`orders?${params}`);
    $('orders-tb').innerHTML = d.orders.length
      ? d.orders
          .map(
            (o) => `
          <tr>
            <td class="mono">${esc(o.code)}</td>
            <td>${esc(o.customer_name)}<br><small class="mono" style="color:var(--ink-dim)">${esc(o.customer_phone)}</small></td>
            <td>${esc(o.governorate)}</td>
            <td class="mono">${fmt(o.total)}</td>
            <td><span class="badge">${esc(o.payment_method)} · ${esc(o.payment_status)}</span></td>
            <td><span class="badge">${esc(o.status)}</span></td>
            <td class="mono" style="font-size:11px">${esc(o.created_at)}</td>
            <td><button type="button" class="sm-btn" data-view-order="${o.id}">Manage</button></td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="8" style="color:var(--ink-dim)">No matching orders.</td></tr>';
  }

  async function openOrderDetail(id) {
    const { order, items } = await api(`orders/${id}`);
    const panel = $('order-detail-panel');
    panel.hidden = false;
    panel.innerHTML = `
      <div class="panel-head">
        <h2 class="display">Order ${esc(order.code)}</h2>
        <button type="button" class="sm-btn" id="close-ord-detail">Close</button>
      </div>
      <div class="adm-grid2">
        <div>
          <p><strong>Customer:</strong> ${esc(order.customer_name)} (${esc(order.customer_phone)}${order.customer_email ? ` · ${esc(order.customer_email)}` : ''})</p>
          <p><strong>Delivery:</strong> ${esc(order.governorate)} — ${esc(order.address)}</p>
          ${order.notes ? `<p><strong>Notes:</strong> ${esc(order.notes)}</p>` : ''}
          <p class="mono" style="margin-top:8px">Subtotal: ${fmt(order.subtotal)} · Discount: -${fmt(order.discount)} · Shipping: ${fmt(order.shipping)} · <strong>Total: ${fmt(order.total)}</strong></p>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
            <select id="od-status" style="padding:8px;background:var(--bg-iron);border:1px solid var(--line-dark);color:var(--ink-bone)">
              ${['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>Status: ${s.toUpperCase()}</option>`).join('')}
            </select>
            <select id="od-pay" style="padding:8px;background:var(--bg-iron);border:1px solid var(--line-dark);color:var(--ink-bone)">
              ${['pending', 'paid', 'failed', 'refunded'].map((s) => `<option value="${s}" ${order.payment_status === s ? 'selected' : ''}>Payment: ${s.toUpperCase()}</option>`).join('')}
            </select>
            <button type="button" class="btn" id="od-save-btn" style="padding:8px 16px">Update Order</button>
          </div>
        </div>
        <div>
          <table class="adm-tbl">
            <thead><tr><th>Piece</th><th>Variant</th><th>Qty</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${items.map((i) => `<tr><td>${esc(i.name)} (${esc(i.sku)})</td><td>${esc(i.size)} / ${esc(i.color)}</td><td>${i.qty}</td><td>${fmt(i.unit_price * i.qty)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    $('close-ord-detail').onclick = () => {
      panel.hidden = true;
    };
    $('od-save-btn').onclick = async () => {
      try {
        await api(`orders/${id}`, {
          method: 'PATCH',
          body: { status: $('od-status').value, paymentStatus: $('od-pay').value }
        });
        toast('Order updated');
        await Promise.all([loadOrders(), loadStats(), loadProducts()]);
        openOrderDetail(id);
      } catch (e) {
        toast(e.message);
      }
    };
  }

  function renderStockInputs() {
    const sizes = $('pf-sizes').value.split(',').map((s) => s.trim()).filter(Boolean);
    const colors = $('pf-colors').value.split(',').map((c) => c.trim()).filter(Boolean);
    const grid = $('pf-stock-grid');
    const items = [];
    sizes.forEach((sz) => {
      colors.forEach((col) => {
        const key = `${sz}|${col}`;
        const val = currentStockMap[key];
        items.push(`
          <div>
            <label>${esc(sz)} · ${esc(col)}</label>
            <input type="number" min="0" data-stock-key="${esc(key)}" value="${val === null || val === undefined ? '' : val}" placeholder="∞">
          </div>
        `);
      });
    });
    grid.innerHTML = items.join('');
  }

  function fillProductForm(p) {
    $('prod-form-title').textContent = p ? `Edit ${p.sku}` : 'New Piece';
    $('pf-id').value = p ? p.id : '';
    $('pf-sku').value = p ? p.sku : '';
    $('pf-name').value = p ? p.name : '';
    $('pf-cat').value = p ? p.category : 'men';
    $('pf-price').value = p ? p.price : '';
    $('pf-compare').value = p && p.compareAt ? p.compareAt : '';
    $('pf-sizes').value = p ? p.sizes.join(', ') : 'S, M, L, XL';
    $('pf-colors').value = p ? p.colors.join(', ') : 'Black';
    $('pf-image').value = p ? p.image : '/assets/images/compression-tee.jpg';
    $('pf-summary').value = p ? p.summary : '';
    $('pf-specs').value = p ? p.specs.join('\n') : '';
    $('pf-sort').value = p ? p.sortOrder : catalog.length;
    $('pf-active').checked = p ? p.active : true;
    $('pf-delete-btn').hidden = !p;
    currentStockMap = p ? { ...p.stock } : {};
    renderStockInputs();
  }

  async function loadProducts() {
    const d = await api('products');
    catalog = d.products;
    $('prod-count').textContent = catalog.length;
    $('products-tb').innerHTML = catalog
      .map(
        (p) => `
        <tr>
          <td class="mono">${esc(p.sku)}</td>
          <td>${esc(p.name)}</td>
          <td class="mono">${esc(p.category)}</td>
          <td class="mono">${fmt(p.price)}${p.compareAt ? ` <s style="color:var(--ink-dim)">${fmt(p.compareAt)}</s>` : ''}</td>
          <td class="mono">${p.sold}</td>
          <td>${p.active ? '<span class="badge">Yes</span>' : '<span class="badge" style="color:var(--rust)">Hidden</span>'}</td>
          <td><button type="button" class="sm-btn" data-edit-prod="${p.id}">Edit</button></td>
        </tr>`
      )
      .join('');
    if (!$('pf-id').value && catalog[0]) fillProductForm(catalog[0]);
  }

  async function loadPromos() {
    const d = await api('promos');
    $('promos-tb').innerHTML = d.promos
      .map(
        (p) => `
        <tr>
          <td class="mono"><strong>${esc(p.code)}</strong></td>
          <td class="mono">${p.percent}%</td>
          <td class="mono">${fmt(p.min_subtotal)}</td>
          <td class="mono">${p.used_count}${p.max_uses ? ` / ${p.max_uses}` : ''}</td>
          <td>${p.active ? 'Active' : 'Off'}</td>
          <td><button type="button" class="sm-btn sm-btn--danger" data-del-promo="${esc(p.code)}">Delete</button></td>
        </tr>`
      )
      .join('');
  }

  async function loadCustomers() {
    const [c, s] = await Promise.all([api('customers'), api('subscribers')]);
    $('customers-tb').innerHTML = c.customers.length
      ? c.customers
          .map(
            (u) => `<tr><td>${esc(u.name)}</td><td class="mono">${esc(u.phone)}</td><td class="mono">${u.orders}</td><td class="mono">${fmt(u.spent)}</td><td class="mono" style="font-size:11px">${esc(u.last_order || '—')}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="5" style="color:var(--ink-dim)">No customer orders yet.</td></tr>';
    $('sub-count').textContent = s.subscribers.length;
    $('subs-tb').innerHTML = s.subscribers.length
      ? s.subscribers.map((x) => `<tr><td class="mono">${esc(x.email)}</td><td class="mono" style="font-size:11px">${esc(x.created_at)}</td></tr>`).join('')
      : '<tr><td colspan="2" style="color:var(--ink-dim)">No newsletter subscribers yet.</td></tr>';
  }

  async function loadSettings() {
    const { settings } = await api('settings');
    $('st-wa').value = settings.whatsapp;
    $('st-ship').value = settings.shippingFee;
    $('st-free').value = settings.freeShippingThreshold;
    $('st-promo').value = settings.welcomePromo || '';
    $('st-tall').value = settings.tallCm;
    $('st-short').value = settings.shortCm;

    $('st-guide-rows').innerHTML = settings.sizeGuide
      .map(
        (row, idx) => `
        <div class="adm-row" data-guide-row="${idx}">
          <div><label>Size Label</label><input data-g-size value="${esc(row.size)}" required></div>
          <div>
            <label>${idx === settings.sizeGuide.length - 1 ? 'Upper Weight (No limit)' : 'Max Weight Below (kg)'}</label>
            <input type="number" data-g-below value="${row.below ?? ''}" ${idx === settings.sizeGuide.length - 1 ? 'disabled placeholder="And above"' : 'required'}>
          </div>
        </div>`
      )
      .join('');
  }

  // Tabs
  $('adm-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    const target = btn.dataset.tab;
    document.querySelectorAll('.adm-tab').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('[data-pane]').forEach((p) => {
      p.hidden = p.dataset.pane !== target;
    });
  });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-err').textContent = '';
    try {
      await api('login', { method: 'POST', body: { password: $('adm-pass').value } });
      $('adm-pass').value = '';
      showApp(true);
    } catch (err) {
      $('login-err').textContent = err.message;
    }
  });

  $('logout-btn').addEventListener('click', async () => {
    await api('logout', { method: 'POST' });
    showApp(false);
  });

  $('ord-q').addEventListener('input', loadOrders);
  $('ord-status').addEventListener('change', loadOrders);
  $('orders-tb').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view-order]');
    if (b) openOrderDetail(b.dataset.viewOrder);
  });

  $('products-tb').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-prod]');
    if (!b) return;
    const p = catalog.find((x) => x.id === Number(b.dataset.editProd));
    if (p) fillProductForm(p);
  });

  $('new-prod-btn').addEventListener('click', () => fillProductForm(null));
  $('pf-sizes').addEventListener('input', renderStockInputs);
  $('pf-colors').addEventListener('input', renderStockInputs);
  $('pf-stock-grid').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-stock-key]');
    if (inp) currentStockMap[inp.dataset.stockKey] = inp.value === '' ? null : Number(inp.value);
  });

  $('pf-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const res = await api('upload', { method: 'POST', body: buf });
      $('pf-image').value = res.url;
      toast('Image uploaded');
    } catch (err) {
      toast(err.message);
    }
  });

  $('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('pf-id').value;
    const stock = {};
    document.querySelectorAll('[data-stock-key]').forEach((inp) => {
      stock[inp.dataset.stockKey] = inp.value === '' ? null : Number(inp.value);
    });
    const payload = {
      sku: $('pf-sku').value.trim(),
      name: $('pf-name').value.trim(),
      category: $('pf-cat').value,
      price: Number($('pf-price').value),
      compareAt: $('pf-compare').value ? Number($('pf-compare').value) : null,
      sizes: $('pf-sizes').value.split(',').map((s) => s.trim()).filter(Boolean),
      colors: $('pf-colors').value.split(',').map((c) => c.trim()).filter(Boolean),
      image: $('pf-image').value.trim(),
      summary: $('pf-summary').value.trim(),
      specs: $('pf-specs').value.split('\n').map((s) => s.trim()).filter(Boolean),
      sortOrder: Number($('pf-sort').value) || 0,
      active: $('pf-active').checked,
      stock
    };
    try {
      if (id) await api(`products/${id}`, { method: 'PUT', body: payload });
      else await api('products', { method: 'POST', body: payload });
      toast('Product saved');
      await loadProducts();
    } catch (err) {
      toast(err.message);
    }
  });

  $('pf-delete-btn').addEventListener('click', async () => {
    const id = $('pf-id').value;
    if (!id) return;
    try {
      await api(`products/${id}`, { method: 'DELETE' });
      toast('Product removed');
      fillProductForm(null);
      await loadProducts();
    } catch (err) {
      toast(err.message);
    }
  });

  $('promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('pr-code').value.trim().toUpperCase();
    const payload = {
      code,
      percent: Number($('pr-pct').value),
      minSubtotal: Number($('pr-min').value) || 0,
      maxUses: $('pr-max').value ? Number($('pr-max').value) : null,
      expiresAt: $('pr-exp').value || null,
      active: $('pr-active').checked
    };
    try {
      await api('promos', { method: 'POST', body: payload }).catch(() =>
        api(`promos/${code}`, { method: 'PUT', body: payload })
      );
      toast(`Promo ${code} saved`);
      $('promo-form').reset();
      await loadPromos();
    } catch (err) {
      toast(err.message);
    }
  });

  $('promos-tb').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del-promo]');
    if (!b) return;
    try {
      await api(`promos/${b.dataset.delPromo}`, { method: 'DELETE' });
      toast('Promo deleted');
      await loadPromos();
    } catch (err) {
      toast(err.message);
    }
  });

  $('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = Array.from(document.querySelectorAll('[data-guide-row]'));
    const sizeGuide = rows.map((r, i) => ({
      size: r.querySelector('[data-g-size]').value.trim(),
      below: i === rows.length - 1 ? null : Number(r.querySelector('[data-g-below]').value)
    }));
    try {
      await api('settings', {
        method: 'PUT',
        body: {
          whatsapp: $('st-wa').value.trim(),
          shippingFee: Number($('st-ship').value),
          freeShippingThreshold: Number($('st-free').value),
          welcomePromo: $('st-promo').value.trim(),
          tallCm: Number($('st-tall').value),
          shortCm: Number($('st-short').value),
          sizeGuide
        }
      });
      toast('Settings saved');
      await loadSettings();
    } catch (err) {
      toast(err.message);
    }
  });

  api('me')
    .then((d) => showApp(!!d.authed))
    .catch(() => showApp(false));
})();
