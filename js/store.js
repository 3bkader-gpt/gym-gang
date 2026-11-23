(function () {
  const { BRAND_CONFIG, PRODUCTS, PROMOS } = window.GG;
  const formatEGP = (amount) => `${amount.toLocaleString('en-US')} EGP`;

  const productById = new Map(PRODUCTS.map((p) => [p.id, p]));
  const selectedSizes = new Map(PRODUCTS.map((p) => [p.id, p.sizes[0]]));

  let bag = loadBag();
  let wish = loadWish();
  let promo = loadPromo();
  let activeFilter = 'all';
  let activeSort = 'featured';
  let query = '';
  let modalProductId = null;
  let modalSelectedSize = null;
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    grid: $('product-grid'),
    filterButtons: Array.from(document.querySelectorAll('.filter-pill')),
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
    modalAdd: $('modal-add-btn'),
    guideModal: $('guide-modal'),
    guideOpen: $('guide-open-btn'),
    guideClose: $('guide-close-btn'),
    guideUse: $('guide-use-btn'),
    toTop: $('to-top-btn')
  };

  /* ---------- storage ---------- */
  function loadBag() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BRAND_CONFIG.storageKey) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && productById.has(item.id) && item.qty > 0)
        : [];
    } catch {
      return [];
    }
  }

  function loadWish() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BRAND_CONFIG.wishKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter((id) => productById.has(id)) : [];
    } catch {
      return [];
    }
  }

  function loadPromo() {
    try {
      const code = localStorage.getItem(BRAND_CONFIG.promoKey) || '';
      return PROMOS[code] ? code : '';
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
    toastTimer = setTimeout(() => el.toast.classList.remove('is-open'), 2100);
  }

  /* ---------- catalog ---------- */
  function renderCatalog() {
    const q = query.trim().toLowerCase();

    const filtered = PRODUCTS.filter((p) => {
      if (activeFilter === 'fav') {
        if (!wish.includes(p.id)) return false;
      } else if (activeFilter !== 'all' && p.category !== activeFilter) {
        return false;
      }
      return !q || p.name.toLowerCase().includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (activeSort === 'low') return a.price - b.price;
      if (activeSort === 'high') return b.price - a.price;
      return a.id - b.id;
    });

    el.countLabel.textContent = `${sorted.length} ${sorted.length === 1 ? 'piece' : 'pieces'}`;
    el.noResults.hidden = sorted.length > 0;
    el.favCount.textContent = String(wish.length);

    el.grid.innerHTML = sorted
      .map((p, index) => {
        const currentSize = selectedSizes.get(p.id) || p.sizes[0];
        const loadingMode = index < 6 ? 'eager' : 'lazy';
        const saved = wish.includes(p.id);
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
                <span class="p-price">${formatEGP(p.price)}</span>
              </div>
              <p class="p-meta">${p.summary}</p>
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
              <button type="button" class="add-btn" data-add="${p.id}">Add to bag</button>
            </div>
          </article>`;
      })
      .join('');
  }

  function toggleWish(id, heartBtn) {
    const idx = wish.indexOf(id);
    if (idx > -1) {
      wish.splice(idx, 1);
    } else {
      wish.push(id);
    }
    persist();
    el.favCount.textContent = String(wish.length);
    showToast(idx > -1 ? 'Removed from your list' : 'Saved to your list');

    if (activeFilter === 'fav') {
      renderCatalog();
    } else if (heartBtn) {
      heartBtn.setAttribute('aria-pressed', String(idx === -1));
    }
  }

  /* ---------- bag ---------- */
  function addToBag(id, size, triggerBtn) {
    const product = productById.get(id);
    if (!product) return;

    const chosenSize = size || selectedSizes.get(id) || product.sizes[0];
    const existing = bag.find((item) => item.id === id && item.size === chosenSize);
    if (existing) {
      existing.qty += 1;
    } else {
      bag.push({ id, size: chosenSize, qty: 1 });
    }

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
    const subtotal = bag.reduce((sum, item) => sum + productById.get(item.id).price * item.qty, 0);
    const discount = Math.round((subtotal * (PROMOS[promo] || 0)) / 100);
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
                <small>${product.sku} · Size ${item.size}</small>
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

  /* ---------- modals ---------- */
  function openQuickView(id) {
    const product = productById.get(id);
    if (!product) return;

    modalProductId = id;
    modalSelectedSize = selectedSizes.get(id) || product.sizes[0];

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

  /* ---------- public API for the Gear Lab ---------- */
  window.GG.applyRecommendedSizes = function applyRecommendedSizes(teeSize, hoodieSize) {
    selectedSizes.set(0, teeSize);
    selectedSizes.set(3, hoodieSize);
    renderCatalog();
    showToast(`Applied sizes: Tee ${teeSize} · Hoodie ${hoodieSize}`);
  };

  window.GG.applyPromo = function applyPromo(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!PROMOS[clean]) return false;
    promo = clean;
    renderBag();
    return true;
  };

  /* ---------- wiring ---------- */
  renderCatalog();
  renderBag();

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
      sizeBtn.parentElement.querySelectorAll('.size-btn').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn === sizeBtn));
      });
      return;
    }

    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const id = Number(addBtn.dataset.add);
      addToBag(id, selectedSizes.get(id), addBtn);
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
      bag[Number(inc.dataset.qtyInc)].qty += 1;
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
    if (product) addToBag(product.id, product.sizes[0]);
  });

  el.promoApply.addEventListener('click', () => {
    const value = el.promoInput.value.trim().toUpperCase();
    el.promoInput.value = '';
    if (!value) return;
    if (PROMOS[value]) {
      promo = value;
      renderBag();
      showToast(`${value} applied`);
    } else {
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

  el.checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!bag.length) return;

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
      `Name: ${$('ck-name').value.trim()}`,
      `Phone: ${$('ck-phone').value.trim()}`,
      `City: ${$('ck-city').value}`,
      `Address: ${$('ck-address').value.trim()}`,
      `Payment: ${document.querySelector('input[name="payment-method"]:checked').value}`,
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
      renderCatalog();
    }
  });

  el.modalAdd.addEventListener('click', () => {
    if (modalProductId === null) return;
    addToBag(modalProductId, modalSelectedSize, el.modalAdd);
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
    }
  });
})();
