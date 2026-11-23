(function () {
  const { byId, formatCurrency, escapeHtml, showToast, requestAdminApi, loadOverviewStats, setAuthenticatedView } = window.GGAdmin;

  let catalog = [];
  let currentStockMap = {};

  async function loadOrders() {
    const params = new URLSearchParams();
    if (byId('ord-q').value.trim()) params.set('q', byId('ord-q').value.trim());
    if (byId('ord-status').value) params.set('status', byId('ord-status').value);
    const data = await requestAdminApi(`orders?${params}`);
    byId('orders-tb').innerHTML = data.orders.length
      ? data.orders
          .map(
            (o) => `
          <tr>
            <td class="mono">${escapeHtml(o.code)}</td>
            <td>${escapeHtml(o.customer_name)}<br><small class="mono" style="color:var(--ink-dim)">${escapeHtml(o.customer_phone)}</small></td>
            <td>${escapeHtml(o.governorate)}</td>
            <td class="mono">${formatCurrency(o.total)}</td>
            <td><span class="badge">${escapeHtml(o.payment_method)} · ${escapeHtml(o.payment_status)}</span></td>
            <td><span class="badge">${escapeHtml(o.status)}</span></td>
            <td class="mono" style="font-size:11px">${escapeHtml(o.created_at)}</td>
            <td><button type="button" class="sm-btn" data-view-order="${o.id}">Manage</button></td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="8" style="color:var(--ink-dim)">No matching orders.</td></tr>';
  }

  async function openOrderDetail(orderId) {
    const { order, items } = await requestAdminApi(`orders/${orderId}`);
    const panel = byId('order-detail-panel');
    panel.hidden = false;
    panel.innerHTML = `
      <div class="panel-head">
        <h2 class="display">Order ${escapeHtml(order.code)}</h2>
        <button type="button" class="sm-btn" id="close-ord-detail">Close</button>
      </div>
      <div class="adm-grid2">
        <div>
          <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)} (${escapeHtml(order.customer_phone)}${order.customer_email ? ` · ${escapeHtml(order.customer_email)}` : ''})</p>
          <p><strong>Delivery:</strong> ${escapeHtml(order.governorate)} — ${escapeHtml(order.address)}</p>
          ${order.notes ? `<p><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}
          <p class="mono" style="margin-top:8px">Subtotal: ${formatCurrency(order.subtotal)} · Discount: -${formatCurrency(order.discount)} · Shipping: ${formatCurrency(order.shipping)} · <strong>Total: ${formatCurrency(order.total)}</strong></p>
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
            <tbody>${items.map((i) => `<tr><td>${escapeHtml(i.name)} (${escapeHtml(i.sku)})</td><td>${escapeHtml(i.size)} / ${escapeHtml(i.color)}</td><td>${i.qty}</td><td>${formatCurrency(i.unit_price * i.qty)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
    byId('close-ord-detail').onclick = () => { panel.hidden = true; };
    byId('od-save-btn').onclick = async () => {
      try {
        await requestAdminApi(`orders/${orderId}`, { method: 'PATCH', body: { status: byId('od-status').value, paymentStatus: byId('od-pay').value } });
        showToast('Order updated');
        await Promise.all([loadOrders(), loadOverviewStats(), loadProducts()]);
        openOrderDetail(orderId);
      } catch (err) { showToast(err.message); }
    };
  }

  function renderVariantStockInputs() {
    const sizes = byId('pf-sizes').value.split(',').map((s) => s.trim()).filter(Boolean);
    const colors = byId('pf-colors').value.split(',').map((c) => c.trim()).filter(Boolean);
    const cells = [];
    sizes.forEach((sz) => {
      colors.forEach((col) => {
        const key = `${sz}|${col}`;
        const val = currentStockMap[key];
        cells.push(`<div><label>${escapeHtml(sz)} · ${escapeHtml(col)}</label><input type="number" min="0" data-stock-key="${escapeHtml(key)}" value="${val ?? ''}" placeholder="∞"></div>`);
      });
    });
    byId('pf-stock-grid').innerHTML = cells.join('');
  }

  function fillProductForm(product) {
    byId('prod-form-title').textContent = product ? `Edit ${product.sku}` : 'New Piece';
    byId('pf-id').value = product ? product.id : '';
    byId('pf-sku').value = product ? product.sku : '';
    byId('pf-name').value = product ? product.name : '';
    byId('pf-cat').value = product ? product.category : 'men';
    byId('pf-price').value = product ? product.price : '';
    byId('pf-compare').value = product?.compareAt || '';
    byId('pf-sizes').value = product ? product.sizes.join(', ') : 'S, M, L, XL';
    byId('pf-colors').value = product ? product.colors.join(', ') : 'Black';
    byId('pf-image').value = product ? product.image : '/assets/images/compression-tee.jpg';
    byId('pf-summary').value = product ? product.summary : '';
    byId('pf-specs').value = product ? product.specs.join('\n') : '';
    byId('pf-sort').value = product ? product.sortOrder : catalog.length;
    byId('pf-active').checked = product ? product.active : true;
    byId('pf-delete-btn').hidden = !product;
    currentStockMap = product ? { ...product.stock } : {};
    renderVariantStockInputs();
  }

  async function loadProducts() {
    const data = await requestAdminApi('products');
    catalog = data.products;
    byId('prod-count').textContent = catalog.length;
    byId('products-tb').innerHTML = catalog
      .map((p) => `
        <tr>
          <td class="mono">${escapeHtml(p.sku)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td class="mono">${escapeHtml(p.category)}</td>
          <td class="mono">${formatCurrency(p.price)}${p.compareAt ? ` <s style="color:var(--ink-dim)">${formatCurrency(p.compareAt)}</s>` : ''}</td>
          <td class="mono">${p.sold}</td>
          <td>${p.active ? '<span class="badge">Yes</span>' : '<span class="badge" style="color:var(--rust)">Hidden</span>'}</td>
          <td><button type="button" class="sm-btn" data-edit-prod="${p.id}">Edit</button></td>
        </tr>`)
      .join('');
    if (!byId('pf-id').value && catalog[0]) fillProductForm(catalog[0]);
  }

  async function loadPromos() {
    const data = await requestAdminApi('promos');
    byId('promos-tb').innerHTML = data.promos
      .map((p) => `
        <tr>
          <td class="mono"><strong>${escapeHtml(p.code)}</strong></td>
          <td class="mono">${p.percent}%</td>
          <td class="mono">${formatCurrency(p.min_subtotal)}</td>
          <td class="mono">${p.used_count}${p.max_uses ? ` / ${p.max_uses}` : ''}</td>
          <td>${p.active ? 'Active' : 'Off'}</td>
          <td><button type="button" class="sm-btn sm-btn--danger" data-del-promo="${escapeHtml(p.code)}">Delete</button></td>
        </tr>`)
      .join('');
  }

  async function loadCustomersAndLeads() {
    const [cust, subs] = await Promise.all([requestAdminApi('customers'), requestAdminApi('subscribers')]);
    byId('customers-tb').innerHTML = cust.customers.length
      ? cust.customers.map((u) => `<tr><td>${escapeHtml(u.name)}</td><td class="mono">${escapeHtml(u.phone)}</td><td class="mono">${u.orders}</td><td class="mono">${formatCurrency(u.spent)}</td><td class="mono" style="font-size:11px">${escapeHtml(u.last_order || '—')}</td></tr>`).join('')
      : '<tr><td colspan="5" style="color:var(--ink-dim)">No customer orders yet.</td></tr>';
    byId('sub-count').textContent = subs.subscribers.length;
    byId('subs-tb').innerHTML = subs.subscribers.length
      ? subs.subscribers.map((x) => `<tr><td class="mono">${escapeHtml(x.email)}</td><td class="mono" style="font-size:11px">${escapeHtml(x.created_at)}</td></tr>`).join('')
      : '<tr><td colspan="2" style="color:var(--ink-dim)">No newsletter subscribers yet.</td></tr>';
  }

  async function loadSettings() {
    const { settings } = await requestAdminApi('settings');
    byId('st-wa').value = settings.whatsapp;
    byId('st-ship').value = settings.shippingFee;
    byId('st-free').value = settings.freeShippingThreshold;
    byId('st-promo').value = settings.welcomePromo || '';
    byId('st-tall').value = settings.tallCm;
    byId('st-short').value = settings.shortCm;
    byId('st-guide-rows').innerHTML = settings.sizeGuide
      .map((row, idx) => `
        <div class="adm-row" data-guide-row="${idx}">
          <div><label>Size Label</label><input data-g-size value="${escapeHtml(row.size)}" required></div>
          <div>
            <label>${idx === settings.sizeGuide.length - 1 ? 'Upper Weight (No limit)' : 'Max Weight Below (kg)'}</label>
            <input type="number" data-g-below value="${row.below ?? ''}" ${idx === settings.sizeGuide.length - 1 ? 'disabled placeholder="And above"' : 'required'}>
          </div>
        </div>`)
      .join('');
  }

  window.GGAdmin.loadAllPanels = () => Promise.all([loadOverviewStats(), loadOrders(), loadProducts(), loadPromos(), loadCustomersAndLeads(), loadSettings()]);

  byId('ord-q').oninput = loadOrders;
  byId('ord-status').onchange = loadOrders;
  byId('orders-tb').onclick = (e) => { const b = e.target.closest('[data-view-order]'); if (b) openOrderDetail(b.dataset.viewOrder); };
  byId('products-tb').onclick = (e) => { const b = e.target.closest('[data-edit-prod]'); if (b) fillProductForm(catalog.find((x) => x.id === Number(b.dataset.editProd))); };
  byId('new-prod-btn').onclick = () => fillProductForm(null);
  byId('pf-sizes').oninput = renderVariantStockInputs;
  byId('pf-colors').oninput = renderVariantStockInputs;
  byId('pf-stock-grid').oninput = (e) => { const inp = e.target.closest('[data-stock-key]'); if (inp) currentStockMap[inp.dataset.stockKey] = inp.value === '' ? null : Number(inp.value); };

  byId('pf-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await requestAdminApi('upload', { method: 'POST', body: await file.arrayBuffer() });
      byId('pf-image').value = res.url;
      showToast('Image uploaded');
    } catch (err) { showToast(err.message); }
  };

  byId('prod-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = byId('pf-id').value;
    const stock = {};
    document.querySelectorAll('[data-stock-key]').forEach((inp) => { stock[inp.dataset.stockKey] = inp.value === '' ? null : Number(inp.value); });
    const body = {
      sku: byId('pf-sku').value.trim(), name: byId('pf-name').value.trim(), category: byId('pf-cat').value,
      price: Number(byId('pf-price').value), compareAt: byId('pf-compare').value ? Number(byId('pf-compare').value) : null,
      sizes: byId('pf-sizes').value.split(',').map((s) => s.trim()).filter(Boolean),
      colors: byId('pf-colors').value.split(',').map((c) => c.trim()).filter(Boolean),
      image: byId('pf-image').value.trim(), summary: byId('pf-summary').value.trim(),
      specs: byId('pf-specs').value.split('\n').map((s) => s.trim()).filter(Boolean),
      sortOrder: Number(byId('pf-sort').value) || 0, active: byId('pf-active').checked, stock
    };
    try {
      await requestAdminApi(id ? `products/${id}` : 'products', { method: id ? 'PUT' : 'POST', body });
      showToast('Product saved');
      await loadProducts();
    } catch (err) { showToast(err.message); }
  };

  byId('pf-delete-btn').onclick = async () => {
    const id = byId('pf-id').value;
    if (!id) return;
    try { await requestAdminApi(`products/${id}`, { method: 'DELETE' }); showToast('Product removed'); fillProductForm(null); await loadProducts(); }
    catch (err) { showToast(err.message); }
  };

  byId('promo-form').onsubmit = async (e) => {
    e.preventDefault();
    const code = byId('pr-code').value.trim().toUpperCase();
    const body = { code, percent: Number(byId('pr-pct').value), minSubtotal: Number(byId('pr-min').value) || 0, maxUses: byId('pr-max').value ? Number(byId('pr-max').value) : null, expiresAt: byId('pr-exp').value || null, active: byId('pr-active').checked };
    try {
      await requestAdminApi('promos', { method: 'POST', body }).catch(() => requestAdminApi(`promos/${code}`, { method: 'PUT', body }));
      showToast(`Promo ${code} saved`);
      byId('promo-form').reset();
      await loadPromos();
    } catch (err) { showToast(err.message); }
  };

  byId('promos-tb').onclick = async (e) => {
    const b = e.target.closest('[data-del-promo]');
    if (b) { await requestAdminApi(`promos/${b.dataset.delPromo}`, { method: 'DELETE' }); showToast('Promo deleted'); await loadPromos(); }
  };

  byId('settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const rows = Array.from(document.querySelectorAll('[data-guide-row]'));
    const sizeGuide = rows.map((r, i) => ({ size: r.querySelector('[data-g-size]').value.trim(), below: i === rows.length - 1 ? null : Number(r.querySelector('[data-g-below]').value) }));
    try {
      await requestAdminApi('settings', { method: 'PUT', body: { whatsapp: byId('st-wa').value.trim(), shippingFee: Number(byId('st-ship').value), freeShippingThreshold: Number(byId('st-free').value), welcomePromo: byId('st-promo').value.trim(), tallCm: Number(byId('st-tall').value), shortCm: Number(byId('st-short').value), sizeGuide } });
      showToast('Settings saved');
      await loadSettings();
    } catch (err) { showToast(err.message); }
  };

  requestAdminApi('me').then((d) => setAuthenticatedView(!!d.authed)).catch(() => setAuthenticatedView(false));
})();
