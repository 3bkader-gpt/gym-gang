(function () {
  const { BRAND_CONFIG, PROMOS } = window.GG;
  let PRODUCTS = window.GG.PRODUCTS;
  const formatEGP = (amount) => `${Number(amount || 0).toLocaleString('en-US')} EGP`;

  let productById = new Map(PRODUCTS.map((p) => [p.id, p]));
  const selectedSizes = new Map(PRODUCTS.map((p) => [p.id, p.sizes[0]]));
  const selectedColors = new Map(PRODUCTS.map((p) => [p.id, (p.colors && p.colors[0]) || 'Black']));

  let bag = loadBag();
  let wish = loadWish();
  let promo = loadPromo();
  let promoPercent = PROMOS[promo] || 0;
  let activeFilter = 'all';
  let activeSizeFilter = '';
  let activeColorFilter = '';
  let maxPriceFilter = 0;
  let activeSort = 'featured';
  let query = '';
  let modalProductId = null;
  let modalSelectedSize = null;
  let modalSelectedColor = null;
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    grid: $('product-grid'),
    filterButtons: Array.from(document.querySelectorAll('.filter-pill')),
    sizeFilter: $('filter-size'),
    colorFilter: $('filter-color'),
    priceFilter: $('filter-price'),
    sortSelect: $('sort-select'),
    searchInput: $('search-input'),
    noResults: $('no-results'),
    countLabel: $('catalog-count'),
    favCount: $('fav-count'),
    bagButton: $('bag-open-btn'),
    bagCount: $('bag-count'),
    backdrop: $('drawer-backdrop'),
    drawer: $('bag-drawer'),
    drawerClose: $('drawer-close-btn'),
    shipFill: $('ship-fill'),
    shipText: $('ship-text'),
    etaNote: $('eta-note'),
    bagItems: $('bag-items'),
    upsell: $('upsell'),
    promoInput: $('promo-input'),
    promoApply: $('promo-apply-btn'),
    promoMsg: $('promo-msg'),
    subtotal: $('bag-subtotal'),
    shipping: $('bag-shipping'),
    discountRow: $('discount-row'),
    discountLabel: $('discount-label'),
    discountVal: $('bag-discount'),
    total: $('bag-total'),
    checkoutToggle: $('checkout-toggle-btn'),
    checkoutForm: $('checkout-form'),
    citySelect: $('ck-city'),
    paymobWrap: $('paymob-option-wrap'),
    toast: $('toast'),
    modal: $('quickview-modal'),
    modalClose: $('modal-close-btn'),
    modalImg: $('modal-img'),
    modalSku: $('modal-sku'),
    modalTitle: $('modal-title'),
    modalPrice: $('modal-price'),
    modalDesc: $('modal-desc'),
    modalSpecs: $('modal-specs'),
    modalSizes: $('modal-sizes'),
    modalColors: $('modal-colors'),
    modalAdd: $('modal-add-btn'),
    guideModal: $('guide-modal'),
    guideOpen: $('guide-open-btn'),
    guideClose: $('guide-close-btn'),
    guideUse: $('guide-use-btn'),
    guideTable: $('guide-table-body'),
    guideNote: $('guide-note-text'),
    policyModal: $('policy-modal'),
    policyClose: $('policy-close-btn'),
    policyTitle: $('policy-title'),
    policyBody: $('policy-body'),
    toTop: $('to-top-btn')
  };

  function getVariantStock(product, size, color) {
    if (!product || !product.stock) return null;
    const col = color || (product.colors && product.colors[0]) || 'Black';
    const val = product.stock[`${size}|${col}`];
    return val === undefined ? null : val;
  }

  function qtyInBag(productId, size, color) {
    const item = bag.find((x) => x.id === productId && x.size === size && x.color === color);
    return item ? item.qty : 0;
  }

  function loadBag() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BRAND_CONFIG.storageKey) || '[]');
      return Array.isArray(parsed)
        ? parsed
            .filter((item) => item && item.qty > 0)
            .map((item) => ({
              id: Number(item.id),
              size: item.size || 'S',
              color: item.color || 'Black',
              qty: Number(item.qty)
            }))
        : [];
    } catch {
      return [];
    }
  }

  function loadWish() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BRAND_CONFIG.wishKey) || '[]');
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }

  function loadPromo() {
    try {
      const code = localStorage.getItem(BRAND_CONFIG.promoKey) || '';
      return code ? code.toUpperCase() : '';
    } catch {
      return '';
    }
  }

  function persist() {
    try {
      localStorage.setItem(BRAND_CONFIG.storageKey, JSON.stringify(bag));
      localStorage.setItem(BRAND_CONFIG.wishKey, JSON.stringify(wish));
      localStorage.setItem(BRAND_CONFIG.promoKey, promo);
    } catch {
      // Storage unavailable
    }
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-open'), 2400);
  }

  function populateFilterDropdowns() {
    const allSizes = new Set();
    const allColors = new Set();
    PRODUCTS.forEach((p) => {
      (p.sizes || []).forEach((s) => allSizes.add(s));
      (p.colors || ['Black']).forEach((c) => allColors.add(c));
    });
    if (el.sizeFilter) {
      const cur = el.sizeFilter.value;
      el.sizeFilter.innerHTML =
        '<option value="">All sizes</option>' +
        [...allSizes].map((s) => `<option value="${s}">${s}</option>`).join('');
      el.sizeFilter.value = cur;
    }
    if (el.colorFilter) {
      const cur = el.colorFilter.value;
      el.colorFilter.innerHTML =
        '<option value="">All colors</option>' +
        [...allColors].map((c) => `<option value="${c}">${c}</option>`).join('');
      el.colorFilter.value = cur;
    }
  }

  function populateGovernorates() {
    if (!el.citySelect) return;
    const govs = BRAND_CONFIG.governorates || ['Cairo', 'Giza', 'Alexandria'];
    el.citySelect.innerHTML = govs.map((g) => `<option value="${g}">${g}</option>`).join('');
  }

  function renderSizeGuideTable() {
    if (!el.guideTable) return;
    const rows = BRAND_CONFIG.sizeGuide || [];
    let prev = null;
    el.guideTable.innerHTML = rows
      .map((r, i) => {
        const label =
          i === 0
            ? `Under ${r.below} kg`
            : r.below === null
            ? `${prev} kg and above`
            : `${prev} to ${r.below - 1} kg`;
        prev = r.below;
        return `<tr><th scope="row">${r.size}</th><td>${label}</td></tr>`;
      })
      .join('');
    if (el.guideNote) {
      el.guideNote.textContent = `Taller than ${BRAND_CONFIG.tallCm} cm? Go one size up. ${BRAND_CONFIG.shortCm} cm or shorter? Go one size down. Between sizes? Size up.`;
    }
  }

  function updateWhatsAppLinks() {
    const wa = BRAND_CONFIG.whatsapp || '201010565783';
    const floatEl = $('wa-help');
    if (floatEl) {
      floatEl.href = `https://wa.me/${wa}?text=${encodeURIComponent('Hi Gym Gang, I need help with my order / size.')}`;
    }
    const contactWa = $('contact-wa-link');
    if (contactWa) {
      contactWa.href = `https://wa.me/${wa}?text=${encodeURIComponent('Hi Gym Gang!')}`;
    }
    const contactTel = $('contact-tel-link');
    if (contactTel) {
      contactTel.href = `tel:+${wa}`;
    }
  }

  function renderCatalog() {
    const q = query.trim().toLowerCase();

    const filtered = PRODUCTS.filter((p) => {
      if (activeFilter === 'fav') {
        if (!wish.includes(p.id)) return false;
      } else if (activeFilter !== 'all' && p.category !== activeFilter) {
        return false;
      }
      if (activeSizeFilter && !(p.sizes || []).includes(activeSizeFilter)) return false;
      if (activeColorFilter && !(p.colors || ['Black']).includes(activeColorFilter)) return false;
      if (maxPriceFilter > 0 && p.price > maxPriceFilter) return false;
      return !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
    });

    const sorted = [...filtered].sort((a, b) => {
      if (activeSort === 'low') return a.price - b.price;
      if (activeSort === 'high') return b.price - a.price;
      if (activeSort === 'newest') return b.id - a.id;
      if (activeSort === 'best') return (b.sold || 0) - (a.sold || 0) || a.id - b.id;
      return (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id);
    });

    el.countLabel.textContent = `${sorted.length} ${sorted.length === 1 ? 'piece' : 'pieces'}`;
    el.noResults.hidden = sorted.length > 0;
    el.favCount.textContent = String(wish.length);

    el.grid.innerHTML = sorted
      .map((p, index) => {
        const currentSize = selectedSizes.get(p.id) || p.sizes[0];
        const currentColor = selectedColors.get(p.id) || (p.colors && p.colors[0]) || 'Black';
        const stock = getVariantStock(p, currentSize, currentColor);
        const outOfStock = stock !== null && stock <= 0;
        const lowStock = stock !== null && stock > 0 && stock <= 4;
        const loadingMode = index < 6 ? 'eager' : 'lazy';
        const saved = wish.includes(p.id);
        const colors = p.colors && p.colors.length ? p.colors : ['Black'];

        return `
          <article class="p-card" data-id="${p.id}">
            <button type="button" class="p-media" data-quickview="${p.id}" aria-label="View details and full spec sheet for ${p.name}">
              <img src="${p.image}" alt="${p.name}" loading="${loadingMode}" decoding="async">
            </button>
            <button type="button" class="hrt" data-heart="${p.id}" aria-label="Save ${p.name}" aria-pressed="${saved}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>
            </button>
            <div class="p-body">
              <div class="p-kicker">
                <span>${p.sku} · ${p.category === 'acc' ? 'GEAR' : p.category}</span>
                <button type="button" class="p-view-link" data-quickview="${p.id}">Full specs</button>
              </div>
              <div class="p-top">
                <h3>${p.name}</h3>
                <span class="p-price">
                  ${p.compareAt ? `<s class="p-compare">${formatEGP(p.compareAt)}</s> ` : ''}${formatEGP(p.price)}
                </span>
              </div>
              <p class="p-meta">${p.summary}</p>
              ${
                colors.length > 1
                  ? `<div class="p-sizes" role="group" aria-label="Select color for ${p.name}" style="margin-bottom:8px">
                      ${colors
                        .map(
                          (col) => `<button type="button" class="size-btn" data-color="${col}" data-product="${p.id}" aria-pressed="${col === currentColor}">${col}</button>`
                        )
                        .join('')}
                    </div>`
                  : ''
              }
              <div class="p-sizes" role="group" aria-label="Select size for ${p.name}">
                ${p.sizes
                  .map(
                    (size) => `
                    <button
                      type="button"
                      class="size-btn"
                      data-size="${size}"
                      data-product="${p.id}"
                      aria-pressed="${size === currentSize}"
                    >${size}</button>`
                  )
                  .join('')}
              </div>
              ${
                outOfStock
                  ? '<p class="stock-note stock-note--out">Sold out in this size</p>'
                  : lowStock
                  ? `<p class="stock-note">Only ${stock} left in ${currentSize}</p>`
                  : ''
              }
              <button type="button" class="add-btn" data-add="${p.id}" ${outOfStock ? 'disabled' : ''}>
                ${outOfStock ? 'Out of stock' : 'Add to bag'}
              </button>
            </div>
          </article>`;
      })
      .join('');
  }

  function toggleWish(id, heartBtn) {
    const idx = wish.indexOf(id);
    if (idx > -1) wish.splice(idx, 1);
    else wish.push(id);
    persist();
    el.favCount.textContent = String(wish.length);
    showToast(idx > -1 ? 'Removed from your list' : 'Saved to your list');

    if (activeFilter === 'fav') renderCatalog();
    else if (heartBtn) heartBtn.setAttribute('aria-pressed', String(idx === -1));
  }

  function addToBag(id, size, color, triggerBtn) {
    const product = productById.get(id);
    if (!product) return;

    const chosenSize = size || selectedSizes.get(id) || product.sizes[0];
    const chosenColor = color || selectedColors.get(id) || (product.colors && product.colors[0]) || 'Black';
    const maxStock = getVariantStock(product, chosenSize, chosenColor);
    const inBag = qtyInBag(id, chosenSize, chosenColor);

    if (maxStock !== null && inBag >= maxStock) {
      showToast(maxStock <= 0 ? `${product.name} (${chosenSize}) is out of stock` : `Max available stock (${maxStock}) reached`);
      return;
    }

    const existing = bag.find((item) => item.id === id && item.size === chosenSize && item.color === chosenColor);
    if (existing) existing.qty += 1;
    else bag.push({ id, size: chosenSize, color: chosenColor, qty: 1 });

    renderBag();
    showToast(`${product.name} (${chosenSize}) added to bag`);

    el.bagButton.classList.remove('bump');
    void el.bagButton.offsetWidth;
    el.bagButton.classList.add('bump');
    setTimeout(() => el.bagButton.classList.remove('bump'), 250);

    if (triggerBtn) {
      const prev = triggerBtn.textContent;
      triggerBtn.textContent = 'Added to bag';
      triggerBtn.classList.add('is-added');
      setTimeout(() => {
        triggerBtn.textContent = prev;
        triggerBtn.classList.remove('is-added');
      }, 1000);
    }
  }

  function getTotals() {
    const subtotal = bag.reduce((sum, item) => {
      const p = productById.get(item.id);
      return sum + (p ? p.price * item.qty : 0);
    }, 0);
    const discount = Math.round((subtotal * (promoPercent || 0)) / 100);
    const delivery = subtotal && subtotal < BRAND_CONFIG.freeShippingThreshold ? BRAND_CONFIG.shippingFee : 0;
    return { subtotal, discount, delivery, total: subtotal - discount + delivery };
  }

  function etaRange() {
    const fmt = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    return `${fmt(2)} to ${fmt(4)}`;
  }

  function renderUpsell(subtotal) {
    if (!subtotal) {
      el.upsell.innerHTML = '';
      return;
    }
    const gap = BRAND_CONFIG.freeShippingThreshold - subtotal;
    const inBag = new Set(bag.map((item) => item.id));
    let best = null;

    PRODUCTS.forEach((p) => {
      const st = getVariantStock(p, p.sizes[0], (p.colors && p.colors[0]) || 'Black');
      if (st !== null && st <= 0) return;
      if (inBag.has(p.id) || p.sizes.length > 1 || (gap > 0 && p.price < gap)) return;
      if (!best || p.price < best.price) best = p;
    });

    if (!best) {
      el.upsell.innerHTML = '';
      return;
    }

    el.upsell.innerHTML = `
      <div class="upsell">
        <img src="${best.image}" alt="">
        <div>
          <small>${gap > 0 ? 'Add this for free delivery' : 'Complete your set'}</small>
          <b>${best.name}</b> · ${formatEGP(best.price)}
        </div>
        <button type="button" data-upsell="${best.id}">Add</button>
      </div>`;
  }

  function renderBag() {
    bag = bag.filter((item) => productById.has(item.id) && item.qty > 0);
    const totalCount = bag.reduce((sum, item) => sum + item.qty, 0);
    const { subtotal, discount, delivery, total } = getTotals();
    const hasItems = totalCount > 0;

    el.bagCount.textContent = String(totalCount);
    el.bagButton.classList.toggle('has-items', hasItems);
    el.subtotal.textContent = formatEGP(subtotal);
    el.shipping.textContent = hasItems ? (delivery ? formatEGP(delivery) : 'Free') : '—';
    el.discountRow.hidden = !discount;
    el.discountLabel.textContent = promo ? `Promo ${promo}` : 'Promo';
    el.discountVal.textContent = `−${formatEGP(discount)}`;
    el.total.textContent = formatEGP(total);

    el.shipFill.style.width = `${Math.min(100, (subtotal / BRAND_CONFIG.freeShippingThreshold) * 100)}%`;

    if (!hasItems) {
      el.shipText.textContent = 'Your bag is empty. Pick a piece from Drop 01.';
    } else if (delivery === 0) {
      el.shipText.textContent = 'You’ve unlocked free delivery across Egypt.';
    } else {
      el.shipText.textContent = `Add ${formatEGP(BRAND_CONFIG.freeShippingThreshold - subtotal)} more for free delivery.`;
    }

    el.etaNote.textContent = hasItems ? `Estimated delivery: ${etaRange()}` : '';
    el.promoMsg.textContent = promo
      ? `${promo} applied${discount ? `. You save ${formatEGP(discount)}` : ''}`
      : '';

    if (!hasItems) {
      el.bagItems.innerHTML = '';
      el.checkoutToggle.hidden = true;
      el.checkoutForm.hidden = true;
    } else {
      el.checkoutToggle.hidden = !el.checkoutForm.hidden;
      el.bagItems.innerHTML = bag
        .map((item, idx) => {
          const product = productById.get(item.id);
          return `
            <div class="bag-item">
              <img src="${product.image}" alt="${product.name}">
              <div>
                <h4>${product.name}</h4>
                <small>${product.sku} · Size ${item.size}${item.color && item.color !== 'Black' ? ` · ${item.color}` : ''}</small>
                <div class="qty-ctrl">
                  <button type="button" data-qty-dec="${idx}" aria-label="Decrease quantity">−</button>
                  <span>${item.qty}</span>
                  <button type="button" data-qty-inc="${idx}" aria-label="Increase quantity">+</button>
                </div>
              </div>
              <div style="text-align:right">
                <div class="mono" style="font-size:13px;font-weight:700">${formatEGP(product.price * item.qty)}</div>
                <button type="button" class="remove-link" data-remove="${idx}">Remove</button>
              </div>
            </div>`;
        })
        .join('');
    }

    renderUpsell(subtotal);
    persist();
  }

  function setDrawerOpen(isOpen) {
    el.drawer.classList.toggle('is-open', isOpen);
    el.backdrop.classList.toggle('is-open', isOpen);
    el.drawer.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) el.drawerClose.focus();
  }

  function openQuickView(id) {
    const product = productById.get(id);
    if (!product) return;

    modalProductId = id;
    modalSelectedSize = selectedSizes.get(id) || product.sizes[0];
    modalSelectedColor = selectedColors.get(id) || (product.colors && product.colors[0]) || 'Black';

    el.modalImg.src = product.image;
    el.modalImg.alt = product.name;
    el.modalSku.textContent = `${product.sku} // ${product.category.toUpperCase()}`;
    el.modalTitle.textContent = product.name;
    el.modalPrice.textContent = formatEGP(product.price);
    el.modalDesc.textContent = product.summary;
    el.modalSpecs.innerHTML = product.specs.map((spec) => `<li>${spec}</li>`).join('');
    el.modalSizes.innerHTML = product.sizes
      .map(
        (size) => `
        <button type="button" class="size-btn" data-modal-size="${size}" aria-pressed="${size === modalSelectedSize}">${size}</button>`
      )
      .join('');

    const colors = product.colors && product.colors.length ? product.colors : ['Black'];
    if (el.modalColors) {
      el.modalColors.hidden = colors.length <= 1;
      el.modalColors.innerHTML = colors
        .map(
          (col) => `
          <button type="button" class="size-btn" data-modal-color="${col}" aria-pressed="${col === modalSelectedColor}">${col}</button>`
        )
        .join('');
    }

    const st = getVariantStock(product, modalSelectedSize, modalSelectedColor);
    const oos = st !== null && st <= 0;
    el.modalAdd.disabled = oos;
    el.modalAdd.textContent = oos ? 'Out of stock' : 'Add to Bag';

    el.modal.classList.add('is-open');
    el.modal.setAttribute('aria-hidden', 'false');
    el.modalClose.focus();
  }

  function closeQuickView() {
    el.modal.classList.remove('is-open');
    el.modal.setAttribute('aria-hidden', 'true');
    modalProductId = null;
  }

  function setGuideOpen(isOpen) {
    el.guideModal.classList.toggle('is-open', isOpen);
    el.guideModal.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) el.guideClose.focus();
  }

  const POLICIES = {
    privacy: {
      title: 'Privacy Policy',
      html: `
        <p>Gym Gang collects only the customer details required to fulfill your order across Egypt: your name, phone number, delivery address, governorate, and optional email address.</p>
        <p>Your order details are stored securely in our store database and used strictly for order confirmation, shipping coordination, and customer support via WhatsApp or phone.</p>
        <p>We never sell or rent your personal contact information to third parties. To request deletion of your subscriber email or customer record, message our support team on WhatsApp.</p>
      `
    },
    terms: {
      title: 'Terms & Conditions',
      html: `
        <p>All prices listed on Gym Gang are in Egyptian Pounds (EGP). Orders placed through the storefront are assigned a unique tracking reference (<code>GG-XXXXX</code>) and confirmed via WhatsApp or online payment.</p>
        <p>Product stock and promotional codes are validated at checkout. In the rare event an item becomes unavailable, our team will contact you promptly with an exchange or full refund option.</p>
      `
    },
    shipping: {
      title: 'Shipping & Returns',
      html: `
        <p><strong>Nationwide Delivery:</strong> Standard delivery takes 2–4 business days across all 27 Egyptian governorates. Flat shipping is ${formatEGP(BRAND_CONFIG.shippingFee)} and free on orders of ${formatEGP(BRAND_CONFIG.freeShippingThreshold)} or more.</p>
        <p><strong>7-Day Size Exchange:</strong> If your size does not fit right, message us on WhatsApp within 7 days of delivery with unworn gear in original condition and we will arrange a size swap.</p>
      `
    }
  };

  function openPolicy(key) {
    const pol = POLICIES[key];
    if (!pol || !el.policyModal) return;
    el.policyTitle.textContent = pol.title;
    el.policyBody.innerHTML = pol.html;
    el.policyModal.classList.add('is-open');
    el.policyModal.setAttribute('aria-hidden', 'false');
    el.policyClose.focus();
  }

  function closePolicy() {
    if (!el.policyModal) return;
    el.policyModal.classList.remove('is-open');
    el.policyModal.setAttribute('aria-hidden', 'true');
  }

  async function syncFromBackend() {
    if (location.protocol === 'file:') return;
    try {
      const [cfgRes, prodRes] = await Promise.all([fetch('/api/config'), fetch('/api/products')]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        Object.assign(BRAND_CONFIG, cfg);
        populateGovernorates();
        renderSizeGuideTable();
        updateWhatsAppLinks();
        if (el.paymobWrap) el.paymobWrap.hidden = !(cfg.paymentMethods && cfg.paymentMethods.paymob);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        if (Array.isArray(data.products) && data.products.length) {
          PRODUCTS = data.products;
          window.GG.PRODUCTS = PRODUCTS;
          productById = new Map(PRODUCTS.map((p) => [p.id, p]));
          PRODUCTS.forEach((p) => {
            if (!selectedSizes.has(p.id)) selectedSizes.set(p.id, p.sizes[0]);
            if (!selectedColors.has(p.id)) selectedColors.set(p.id, (p.colors && p.colors[0]) || 'Black');
          });
          populateFilterDropdowns();
          renderCatalog();
          renderBag();
        }
      }
    } catch {
      // Offline / static fallback active
    }
  }

  window.GG.applyRecommendedSizes = function applyRecommendedSizes(teeSize, hoodieSize) {
    const tee = PRODUCTS.find((p) => p.sku === 'GG-01') || PRODUCTS[0];
    const hoodie = PRODUCTS.find((p) => p.sku === 'GG-04') || PRODUCTS[3];
    if (tee) selectedSizes.set(tee.id, teeSize);
    if (hoodie) selectedSizes.set(hoodie.id, hoodieSize);
    renderCatalog();
    showToast(`Applied sizes: Tee ${teeSize} · Hoodie ${hoodieSize}`);
  };

  window.GG.applyPromo = function applyPromo(code, pct = 10) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return false;
    promo = clean;
    promoPercent = PROMOS[clean] || pct;
    PROMOS[clean] = promoPercent;
    renderBag();
    return true;
  };

  // Init synchronous UI then hydrate from D1 API
  populateFilterDropdowns();
  populateGovernorates();
  renderSizeGuideTable();
  updateWhatsAppLinks();
  renderCatalog();
  renderBag();
  syncFromBackend();

  // Check return URL params from Paymob
  const params = new URLSearchParams(location.search);
  if (params.get('order') && params.get('payment')) {
    const ok = params.get('payment') === 'success';
    showToast(ok ? `Order ${params.get('order')} paid successfully!` : `Payment for ${params.get('order')} was not completed.`);
  }

  el.filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.filter;
      if (next === 'fav' && !wish.length) {
        showToast('Tap the heart on any piece to save it');
        return;
      }
      activeFilter = next;
      el.filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderCatalog();
    });
  });

  if (el.sizeFilter) {
    el.sizeFilter.addEventListener('change', () => {
      activeSizeFilter = el.sizeFilter.value;
      renderCatalog();
    });
  }

  if (el.colorFilter) {
    el.colorFilter.addEventListener('change', () => {
      activeColorFilter = el.colorFilter.value;
      renderCatalog();
    });
  }

  if (el.priceFilter) {
    el.priceFilter.addEventListener('change', () => {
      maxPriceFilter = Number(el.priceFilter.value) || 0;
      renderCatalog();
    });
  }

  el.sortSelect.addEventListener('change', () => {
    activeSort = el.sortSelect.value;
    renderCatalog();
  });

  el.searchInput.addEventListener('input', () => {
    query = el.searchInput.value;
    renderCatalog();
  });

  el.grid.addEventListener('click', (e) => {
    const heart = e.target.closest('[data-heart]');
    if (heart) {
      toggleWish(Number(heart.dataset.heart), heart);
      return;
    }

    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn) {
      const id = Number(sizeBtn.dataset.product);
      selectedSizes.set(id, sizeBtn.dataset.size);
      renderCatalog();
      return;
    }

    const colBtn = e.target.closest('[data-color]');
    if (colBtn) {
      const id = Number(colBtn.dataset.product);
      selectedColors.set(id, colBtn.dataset.color);
      renderCatalog();
      return;
    }

    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const id = Number(addBtn.dataset.add);
      addToBag(id, selectedSizes.get(id), selectedColors.get(id), addBtn);
      return;
    }

    const viewBtn = e.target.closest('[data-quickview]');
    if (viewBtn) openQuickView(Number(viewBtn.dataset.quickview));
  });

  el.bagButton.addEventListener('click', () => setDrawerOpen(true));
  el.drawerClose.addEventListener('click', () => setDrawerOpen(false));
  el.backdrop.addEventListener('click', () => setDrawerOpen(false));

  el.bagItems.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-qty-inc]');
    const dec = e.target.closest('[data-qty-dec]');
    const rem = e.target.closest('[data-remove]');

    if (inc) {
      const item = bag[Number(inc.dataset.qtyInc)];
      const p = productById.get(item.id);
      const maxStock = getVariantStock(p, item.size, item.color);
      if (maxStock !== null && item.qty >= maxStock) {
        showToast(`Only ${maxStock} available in stock`);
        return;
      }
      item.qty += 1;
    } else if (dec) {
      const idx = Number(dec.dataset.qtyDec);
      bag[idx].qty -= 1;
      if (bag[idx].qty <= 0) bag.splice(idx, 1);
    } else if (rem) {
      bag.splice(Number(rem.dataset.remove), 1);
    } else {
      return;
    }
    renderBag();
  });

  el.upsell.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upsell]');
    if (!btn) return;
    const product = productById.get(Number(btn.dataset.upsell));
    if (product) addToBag(product.id, product.sizes[0], (product.colors && product.colors[0]) || 'Black');
  });

  el.promoApply.addEventListener('click', async () => {
    const value = el.promoInput.value.trim().toUpperCase();
    el.promoInput.value = '';
    if (!value) return;

    const { subtotal } = getTotals();
    if (location.protocol !== 'file:') {
      try {
        const res = await fetch('/api/promo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: value, subtotal })
        });
        const data = await res.json();
        if (!res.ok) {
          promo = '';
          promoPercent = 0;
          renderBag();
          el.promoMsg.textContent = data.error || 'That code is not valid.';
          return;
        }
        promo = data.code;
        promoPercent = data.percent;
        PROMOS[promo] = promoPercent;
        renderBag();
        showToast(`${promo} applied`);
        return;
      } catch {
        // Fallback to local PROMOS
      }
    }

    if (PROMOS[value]) {
      promo = value;
      promoPercent = PROMOS[value];
      renderBag();
      showToast(`${value} applied`);
    } else {
      promo = '';
      promoPercent = 0;
      renderBag();
      el.promoMsg.textContent = 'That code is not valid.';
    }
  });

  el.promoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.promoApply.click();
    }
  });

  el.checkoutToggle.addEventListener('click', () => {
    el.checkoutForm.hidden = false;
    el.checkoutToggle.hidden = true;
    $('ck-name').focus();
  });

  el.checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!bag.length) return;

    const submitBtn = el.checkoutForm.querySelector('button[type="submit"]');
    const name = $('ck-name').value.trim();
    const phone = $('ck-phone').value.trim();
    const email = ($('ck-email')?.value || '').trim();
    const governorate = $('ck-city').value;
    const address = $('ck-address').value.trim();
    const notes = ($('ck-notes')?.value || '').trim();
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

    if (location.protocol !== 'file:') {
      submitBtn.disabled = true;
      const origText = submitBtn.textContent;
      submitBtn.textContent = 'Saving order...';
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customer: { name, phone, email: email || undefined },
            governorate,
            address,
            notes: notes || undefined,
            paymentMethod,
            promoCode: promo || undefined,
            items: bag.map((i) => ({ productId: i.id, size: i.size, color: i.color, qty: i.qty }))
          })
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Could not place order.');
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
          return;
        }

        bag = [];
        renderBag();
        syncFromBackend();

        if (data.paymentUrl) {
          showToast(`Order ${data.order.code} saved — redirecting to Paymob...`);
          window.location.href = data.paymentUrl;
          return;
        }

        const waUrl = `https://wa.me/${data.whatsapp.number}?text=${encodeURIComponent(data.whatsapp.text)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        showToast(`Order ${data.order.code} saved! Confirm on WhatsApp.`);
      } catch {
        showToast('Network error — please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
      return;
    }

    // Offline file:// fallback
    const { discount, delivery, total } = getTotals();
    const orderId = `GG-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const lines = [
      `New Gym Gang Order ${orderId} (Drop 01)`,
      ...bag.map((item) => {
        const p = productById.get(item.id);
        return `- ${p.name} (${p.sku}, Size ${item.size}) x${item.qty} = ${formatEGP(p.price * item.qty)}`;
      }),
      ...(discount ? [`Promo ${promo}: -${formatEGP(discount)}`] : []),
      `Delivery: ${delivery ? formatEGP(delivery) : 'Free'}`,
      `Total: ${formatEGP(total)}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Governorate: ${governorate}`,
      `Address: ${address}`,
      `Payment: ${paymentMethod}`,
      `Estimated delivery: ${etaRange()}`
    ];
    const url = `https://wa.me/${BRAND_CONFIG.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`Order ${orderId} ready. Send it on WhatsApp to confirm.`);
  });

  el.modalSizes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modal-size]');
    if (!btn) return;
    modalSelectedSize = btn.dataset.modalSize;
    el.modalSizes.querySelectorAll('.size-btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    if (modalProductId !== null) {
      selectedSizes.set(modalProductId, modalSelectedSize);
      const p = productById.get(modalProductId);
      const st = getVariantStock(p, modalSelectedSize, modalSelectedColor);
      el.modalAdd.disabled = st !== null && st <= 0;
      el.modalAdd.textContent = el.modalAdd.disabled ? 'Out of stock' : 'Add to Bag';
      renderCatalog();
    }
  });

  if (el.modalColors) {
    el.modalColors.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-modal-color]');
      if (!btn) return;
      modalSelectedColor = btn.dataset.modalColor;
      el.modalColors.querySelectorAll('.size-btn').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      if (modalProductId !== null) {
        selectedColors.set(modalProductId, modalSelectedColor);
        renderCatalog();
      }
    });
  }

  el.modalAdd.addEventListener('click', () => {
    if (modalProductId === null) return;
    addToBag(modalProductId, modalSelectedSize, modalSelectedColor, el.modalAdd);
  });

  el.modalClose.addEventListener('click', closeQuickView);
  el.modal.addEventListener('click', (e) => {
    if (e.target === el.modal) closeQuickView();
  });

  el.guideOpen.addEventListener('click', () => setGuideOpen(true));
  el.guideClose.addEventListener('click', () => setGuideOpen(false));
  el.guideUse.addEventListener('click', () => setGuideOpen(false));
  el.guideModal.addEventListener('click', (e) => {
    if (e.target === el.guideModal) setGuideOpen(false);
  });

  document.addEventListener('click', (e) => {
    const polBtn = e.target.closest('[data-policy]');
    if (polBtn) {
      e.preventDefault();
      openPolicy(polBtn.dataset.policy);
    }
  });
  if (el.policyClose) el.policyClose.addEventListener('click', closePolicy);
  if (el.policyModal) {
    el.policyModal.addEventListener('click', (e) => {
      if (e.target === el.policyModal) closePolicy();
    });
  }

  el.toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener(
    'scroll',
    () => el.toTop.classList.toggle('is-visible', window.scrollY > 700),
    { passive: true }
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setDrawerOpen(false);
      closeQuickView();
      setGuideOpen(false);
      closePolicy();
    }
  });
})();
