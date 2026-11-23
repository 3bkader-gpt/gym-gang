(function () {
  const byId = (id) => document.getElementById(id);
  const formatCurrency = (n) => `${Number(n || 0).toLocaleString('en-US')} EGP`;
  const escapeHtml = (str) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let toastTimer = null;

  function showToast(message) {
    const toastEl = byId('adm-toast');
    toastEl.textContent = message;
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-open'), 2400);
  }

  async function requestAdminApi(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body && !(body instanceof ArrayBuffer) && typeof body === 'object') {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const response = await fetch(`/api/admin/${path}`, {
      method: options.method || 'GET',
      headers,
      body,
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    return data;
  }

  async function loadOverviewStats() {
    const data = await requestAdminApi('stats');
    byId('kpi-grid').innerHTML = `
      <div class="kpi"><small>Total Revenue</small><strong>${formatCurrency(data.totals.revenue)}</strong></div>
      <div class="kpi"><small>Paid Revenue</small><strong>${formatCurrency(data.totals.paid_revenue)}</strong></div>
      <div class="kpi"><small>Total Orders</small><strong>${data.totals.orders}</strong></div>
      <div class="kpi"><small>New Orders</small><strong>${data.totals.new_orders}</strong></div>
      <div class="kpi"><small>Avg Order Value</small><strong>${formatCurrency(data.totals.avgOrder)}</strong></div>
      <div class="kpi"><small>Customers / Leads</small><strong>${data.counts.customers} / ${data.counts.subscribers}</strong></div>
    `;
    byId('top-products-tb').innerHTML = data.topProducts.length
      ? data.topProducts.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.qty}</td><td>${formatCurrency(p.revenue)}</td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--ink-dim)">No sales recorded yet.</td></tr>';
    byId('low-stock-tb').innerHTML = data.lowStock.length
      ? data.lowStock.map((v) => `<tr><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.size)} / ${escapeHtml(v.color)}</td><td><span class="badge">${v.stock}</span></td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--ink-dim)">No low-stock variants.</td></tr>';
  }

  function setAuthenticatedView(isAuthed) {
    byId('login-view').hidden = isAuthed;
    byId('app-view').hidden = !isAuthed;
    byId('adm-tabs').hidden = !isAuthed;
    if (isAuthed && window.GGAdmin?.loadAllPanels) window.GGAdmin.loadAllPanels();
  }

  byId('adm-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    const targetPane = btn.dataset.tab;
    document.querySelectorAll('.adm-tab').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('[data-pane]').forEach((pane) => { pane.hidden = pane.dataset.pane !== targetPane; });
  });

  byId('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    byId('login-err').textContent = '';
    try {
      await requestAdminApi('login', { method: 'POST', body: { password: byId('adm-pass').value } });
      byId('adm-pass').value = '';
      setAuthenticatedView(true);
    } catch (err) {
      byId('login-err').textContent = err.message;
    }
  });

  byId('logout-btn').addEventListener('click', async () => {
    await requestAdminApi('logout', { method: 'POST' });
    setAuthenticatedView(false);
  });

  window.GGAdmin = {
    byId,
    formatCurrency,
    escapeHtml,
    showToast,
    requestAdminApi,
    loadOverviewStats,
    setAuthenticatedView
  };
})();
