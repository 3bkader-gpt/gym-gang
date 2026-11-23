(function () {
  const { BRAND_CONFIG, byId, formatCurrency, toast, toggleSound, StoreApiClient, CatalogView, CartDrawer } = window.GG;

  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  const COLORS = { 25: '#c9bba6', 20: '#b3a58f', 15: '#9d9080', 10: '#877b6c', 5: '#6f6559', 2.5: '#575047', 1.25: '#403b35' };
  const HEIGHTS = { 25: 92, 20: 84, 15: 74, 10: 62, 5: 50, 2.5: 40, 1.25: 32 };

  const POLICIES = {
    privacy: {
      title: 'Privacy Policy',
      html: '<p>Gym Gang collects only the customer details required to fulfill your order across Egypt: your name, phone number, delivery address, governorate, and optional email address.</p><p>Your order details are stored securely in our store database and used strictly for order confirmation, shipping coordination, and customer support via WhatsApp or phone.</p>'
    },
    terms: {
      title: 'Terms & Conditions',
      html: '<p>All prices listed on Gym Gang are in Egyptian Pounds (EGP). Orders placed through the storefront receive a unique tracking reference (<code>GG-XXXXX</code>) and are confirmed via WhatsApp or online payment.</p><p>Product stock and promotional codes are validated on our server at checkout.</p>'
    },
    shipping: {
      title: 'Shipping & Returns',
      html: () => `<p><b>Nationwide Delivery:</b> 2–4 business days across all 27 Egyptian governorates. Flat shipping is ${formatCurrency(BRAND_CONFIG.shippingFee)} and free on orders of ${formatCurrency(BRAND_CONFIG.freeShippingThreshold)} or more.</p><p><b>7-Day Size Exchange:</b> Message us on WhatsApp within 7 days of delivery with unworn gear and we will arrange a quick size exchange.</p>`
    }
  };

  function syncStoreSettingsToDom() {
    const citySelect = byId('ct');
    if (citySelect) {
      const govs = BRAND_CONFIG.governorates || ['Cairo', 'Giza', 'Alexandria'];
      citySelect.innerHTML = govs.map((g) => `<option value="${g}">${g}</option>`).join('');
    }
    const guideBody = byId('guide-table-body');
    if (guideBody && Array.isArray(BRAND_CONFIG.sizeGuide)) {
      let prev = null;
      guideBody.innerHTML = BRAND_CONFIG.sizeGuide
        .map((row, idx) => {
          const label = idx === 0 ? `Under ${row.below} kg` : row.below === null ? `${prev} kg and above` : `${prev} to ${row.below - 1} kg`;
          prev = row.below;
          return `<tr><td><b>${row.size}</b></td><td>${label}</td></tr>`;
        })
        .join('');
    }
    const guideNote = byId('guide-note-text');
    if (guideNote) {
      guideNote.textContent = `Taller than ${BRAND_CONFIG.tallCm} cm? Go one size up. ${BRAND_CONFIG.shortCm} cm or shorter? Go one size down. Between sizes? Size up.`;
    }
    const wa = BRAND_CONFIG.whatsapp || '201010565783';
    if (byId('wa')) byId('wa').href = `https://wa.me/${wa}?text=${encodeURIComponent('Hi Gym Gang, I need help with my order / size.')}`;
    if (byId('contact-wa-link')) byId('contact-wa-link').href = `https://wa.me/${wa}?text=${encodeURIComponent('Hi Gym Gang!')}`;
    if (byId('contact-tel-link')) byId('contact-tel-link').href = `tel:+${wa}`;
    if (byId('paymob-option-wrap')) byId('paymob-option-wrap').hidden = !(BRAND_CONFIG.paymentMethods && BRAND_CONFIG.paymentMethods.paymob);
  }

  async function hydrateStoreFromApi() {
    if (!StoreApiClient.isOnlineMode()) return;
    try {
      const { config, products } = await StoreApiClient.fetchConfigAndProducts();
      if (config) {
        Object.assign(BRAND_CONFIG, config);
        syncStoreSettingsToDom();
      }
      if (products) {
        CatalogView.setProducts(products);
        CartDrawer.renderCart();
      }
    } catch {
      // Static fallback active
    }
  }
  window.GG.hydrateStoreFromApi = hydrateStoreFromApi;

  function renderPlateLoader() {
    const totalWeight = Number(byId('pw').value);
    let perSide = (totalWeight - 20) / 2;
    const plates = [];
    byId('pwv').textContent = String(totalWeight);
    PLATES.forEach((p) => {
      const count = Math.floor(perSide / p + 1e-9);
      for (let k = 0; k < count; k += 1) plates.push(p);
      perSide -= count * p;
    });
    const counts = {};
    plates.forEach((p) => { counts[p] = (counts[p] || 0) + 1; });
    const plateEl = (p, i) => `<i style="height:${HEIGHTS[p]}px;background:${COLORS[p]};width:${p >= 10 ? 16 : 10}px;animation-delay:${i * 40}ms"></i>`;
    byId('pbar').innerHTML = `<div class="sd">${plates.slice().reverse().map(plateEl).join('')}</div><span class="br"></span><div class="sd">${plates.map(plateEl).join('')}</div>`;
    byId('pr').textContent = plates.length
      ? `Each side: ${Object.keys(counts).sort((a, b) => b - a).map((p) => `${counts[p]} × ${p} kg`).join(' + ')}. Total ${totalWeight} kg with a 20 kg bar.`
      : 'Just the empty 20 kg bar.';
  }

  function handleSizeFinder(e) {
    e.preventDefault();
    const height = Number(byId('ht').value);
    const weight = Number(byId('wt').value);
    const resultEl = byId('sr');
    if (height < 140 || height > 220 || weight < 35 || weight > 200) {
      resultEl.textContent = 'Enter a height between 140 and 220 cm and a weight between 35 and 200 kg.';
      return;
    }
    const guide = BRAND_CONFIG.sizeGuide || [{ size: 'S', below: 65 }, { size: 'M', below: 78 }, { size: 'L', below: 92 }, { size: 'XL', below: null }];
    const sizes = guide.map((g) => g.size);
    let idx = guide.findIndex((g) => g.below === null || weight < g.below);
    if (idx < 0) idx = sizes.length - 1;
    if (height >= (BRAND_CONFIG.tallCm || 186) && idx < sizes.length - 1) idx += 1;
    if (height <= (BRAND_CONFIG.shortCm || 165) && idx > 0) idx -= 1;

    const hoodieIdx = byId('hf').value === 'o' ? Math.max(idx - 1, 0) : idx;
    resultEl.innerHTML = `Compression tee: <b>${sizes[idx]}</b> &middot; Hoodie: <b>${sizes[hoodieIdx]}</b><button type="button" class="lnk" id="us" style="display:block;margin-top:8px">Use these sizes</button><small>An estimate for typical builds. Between sizes? Size up.</small>`;
    byId('us').onclick = () => {
      window.GG.applyRecommendedSizes(sizes[idx], sizes[hoodieIdx]);
      location.hash = 'shop';
    };
  }

  async function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = byId('em').value.trim();
    if (!email) return;
    if (StoreApiClient.isOnlineMode()) {
      try {
        const data = await StoreApiClient.subscribeNewsletter(email);
        const code = data.promoCode || 'GANG10';
        window.GG.applyPromo(code);
        byId('msg').textContent = data.alreadySubscribed
          ? `You’re already in the gang. Code ${code} is active in your cart.`
          : `You’re in the gang. Code ${code} is applied to your cart: 10% off your first order.`;
        byId('em').value = '';
        return;
      } catch (err) {
        byId('msg').textContent = err.message;
        return;
      }
    }
    window.GG.applyPromo('GANG10');
    byId('msg').textContent = 'You’re in the gang. Code GANG10 is applied to your cart: 10% off your first order.';
    byId('em').value = '';
  }

  // Global delegated click actions for cards, cart & modals
  document.addEventListener('click', (e) => {
    const target = e.target;
    let el;
    if ((el = target.closest('.hrt'))) CatalogView.toggleWishlistItem(Number(el.dataset.h), el);
    else if ((el = target.closest('.sz[data-i] button'))) CatalogView.setSelectedSize(Number(el.parentNode.dataset.i), el.dataset.size || el.textContent);
    else if ((el = target.closest('.sz[data-col-id] button'))) CatalogView.setSelectedColor(Number(el.parentNode.dataset.colId), el.dataset.color || el.textContent);
    else if ((el = target.closest('.add'))) CartDrawer.addItem(Number(el.dataset.i), null, null, el);
    else if ((el = target.closest('[data-u]'))) {
      const p = CatalogView.getProduct(Number(el.dataset.u));
      if (p) CartDrawer.addItem(p.id, p.sizes[0], (p.colors && p.colors[0]) || 'Black');
    } else if ((el = target.closest('[data-z]'))) {
      const p = CatalogView.getProduct(Number(el.dataset.z));
      if (p) { byId('lbi').src = p.image; byId('lbt').textContent = `${p.name} — ${formatCurrency(p.price)} (${(p.specs || []).join(' · ')})`; byId('lb').classList.add('on'); }
    } else if (target.closest('#lb')) byId('lb').classList.remove('on');
    else if ((el = target.closest('[data-p]'))) CartDrawer.changeQty(Number(el.dataset.p), 1);
    else if ((el = target.closest('[data-m]'))) CartDrawer.changeQty(Number(el.dataset.m), -1);
    else if ((el = target.closest('[data-r]'))) CartDrawer.removeItem(Number(el.dataset.r));
    else if (target.closest('#x') || target.id === 'ov') CartDrawer.setDrawerOpen(false);
    else if ((el = target.closest('[data-policy]'))) {
      e.preventDefault();
      const pol = POLICIES[el.dataset.policy];
      if (pol) { byId('pmo-title').textContent = pol.title; byId('pmo-body').innerHTML = typeof pol.html === 'function' ? pol.html() : pol.html; byId('pmo').hidden = false; }
    }
  });

  byId('snd').onclick = function () { toggleSound(this); };
  byId('sgb').onclick = () => { byId('sgm').hidden = false; };
  byId('sgx').onclick = () => { byId('sgm').hidden = true; };
  byId('sgf').onclick = () => { byId('sgm').hidden = true; };
  byId('sgm').onclick = function (e) { if (e.target === this) this.hidden = true; };
  byId('pmo-close').onclick = () => { byId('pmo').hidden = true; };
  byId('pmo').onclick = function (e) { if (e.target === this) this.hidden = true; };
  byId('pw').oninput = renderPlateLoader;
  document.querySelectorAll('.chips button').forEach((b) => { b.onclick = () => { byId('pw').value = b.dataset.w; renderPlateLoader(); }; });
  byId('sf').onsubmit = handleSizeFinder;
  byId('f').onsubmit = handleNewsletterSubmit;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      CartDrawer.setDrawerOpen(false);
      byId('lb').classList.remove('on');
      byId('sgm').hidden = true;
      byId('pmo').hidden = true;
    }
  });

  syncStoreSettingsToDom();
  renderPlateLoader();
  hydrateStoreFromApi();
})();
