(function () {
  const { BRAND_CONFIG, PRODUCTS } = window.GG;
  const formatEGP = (amount) => `${amount.toLocaleString('en-US')} EGP`;

  const productById = new Map(PRODUCTS.map((p) => [p.id, p]));
  const selectedSizes = new Map(PRODUCTS.map((p) => [p.id, p.sizes[0]]));

  let bag = loadBag();
  let activeFilter = 'all';
  let activeSort = 'featured';
  let modalProductId = null;
  let modalSelectedSize = null;
  let toastTimer = null;

  const el = {
    grid: document.getElementById('product-grid'),
    filterButtons: Array.from(document.querySelectorAll('.filter-pill')),
    sortSelect: document.getElementById('sort-select'),
    countLabel: document.getElementById('catalog-count'),
    bagButton: document.getElementById('bag-open-btn'),
    bagCount: document.getElementById('bag-count'),
    backdrop: document.getElementById('drawer-backdrop'),
    drawer: document.getElementById('bag-drawer'),
    drawerClose: document.getElementById('drawer-close-btn'),
    shipFill: document.getElementById('ship-fill'),
    shipText: document.getElementById('ship-text'),
    bagItems: document.getElementById('bag-items'),
    subtotal: document.getElementById('bag-subtotal'),
    shipping: document.getElementById('bag-shipping'),
    total: document.getElementById('bag-total'),
    checkoutToggle: document.getElementById('checkout-toggle-btn'),
    checkoutForm: document.getElementById('checkout-form'),
    toast: document.getElementById('toast'),
    modal: document.getElementById('quickview-modal'),
    modalClose: document.getElementById('modal-close-btn'),
    modalImg: document.getElementById('modal-img'),
    modalSku: document.getElementById('modal-sku'),
    modalTitle: document.getElementById('modal-title'),
    modalPrice: document.getElementById('modal-price'),
    modalDesc: document.getElementById('modal-desc'),
    modalSpecs: document.getElementById('modal-specs'),
    modalSizes: document.getElementById('modal-sizes'),
    modalAdd: document.getElementById('modal-add-btn')
  };

  function loadBag() {
    try {
      const raw = localStorage.getItem(BRAND_CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((item) => productById.has(item.id) && item.qty > 0)
        : [];
    } catch {
      return [];
    }
  }

  function saveBag() {
    try {
      localStorage.setItem(BRAND_CONFIG.storageKey, JSON.stringify(bag));
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

  function renderCatalog() {
    const filtered = PRODUCTS.filter(
      (p) => activeFilter === 'all' || p.category === activeFilter
    );

    const sorted = [...filtered].sort((a, b) => {
      if (activeSort === 'low') return a.price - b.price;
      if (activeSort === 'high') return b.price - a.price;
      return a.id - b.id;
    });

    if (el.countLabel) {
      el.countLabel.textContent = `${sorted.length} ${sorted.length === 1 ? 'piece' : 'pieces'}`;
    }

    el.grid.innerHTML = sorted
      .map((p, index) => {
        const currentSize = selectedSizes.get(p.id) || p.sizes[0];
        const loadingMode = index < 6 ? 'eager' : 'lazy';
        return `
          <article class="p-card" data-id="${p.id}">
            <button type="button" class="p-media" data-quickview="${p.id}" aria-label="View details and full spec sheet for ${p.name}">
              <img src="${p.image}" alt="${p.name}" loading="${loadingMode}" decoding="async">
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
    saveBag();
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

  function renderBag() {
    const totalCount = bag.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = bag.reduce((sum, item) => {
      const product = productById.get(item.id);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);

    const hasItems = totalCount > 0;
    const delivery = hasItems && subtotal < BRAND_CONFIG.freeShippingThreshold ? BRAND_CONFIG.shippingFee : 0;
    const total = subtotal + delivery;

    el.bagCount.textContent = String(totalCount);
    el.subtotal.textContent = formatEGP(subtotal);
    el.shipping.textContent = hasItems ? (delivery ? formatEGP(delivery) : 'Free') : '—';
    el.total.textContent = formatEGP(total);

    const progress = Math.min(100, (subtotal / BRAND_CONFIG.freeShippingThreshold) * 100);
    el.shipFill.style.width = `${progress}%`;

    if (!hasItems) {
      el.shipText.textContent = 'Your bag is empty. Pick a piece from Drop 01.';
    } else if (delivery === 0) {
      el.shipText.textContent = 'Unlocked free Egypt delivery across Drop 01.';
    } else {
      el.shipText.textContent = `Add ${formatEGP(BRAND_CONFIG.freeShippingThreshold - subtotal)} more for free Egypt delivery.`;
    }

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
  }

  function setDrawerOpen(isOpen) {
    el.drawer.classList.toggle('is-open', isOpen);
    el.backdrop.classList.toggle('is-open', isOpen);
    el.drawer.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) {
      el.drawerClose.focus();
    }
  }

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
        <button
          type="button"
          class="size-btn"
          data-modal-size="${size}"
          aria-pressed="${size === modalSelectedSize}"
        >${size}</button>`
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

  window.GG.applyRecommendedSizes = function applyRecommendedSizes(teeSize, hoodieSize) {
    selectedSizes.set(0, teeSize);
    selectedSizes.set(3, hoodieSize);
    renderCatalog();
    showToast(`Applied sizes: Tee ${teeSize} · Hoodie ${hoodieSize}`);
  };

  renderCatalog();
  renderBag();

  el.filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      el.filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderCatalog();
    });
  });

  el.sortSelect.addEventListener('change', () => {
    activeSort = el.sortSelect.value;
    renderCatalog();
  });

  el.grid.addEventListener('click', (e) => {
    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn) {
      const id = Number(sizeBtn.dataset.product);
      const size = sizeBtn.dataset.size;
      selectedSizes.set(id, size);
      const group = sizeBtn.parentElement;
      group.querySelectorAll('.size-btn').forEach((btn) => {
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
    if (viewBtn) {
      openQuickView(Number(viewBtn.dataset.quickview));
    }
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
    saveBag();
  });

  el.checkoutToggle.addEventListener('click', () => {
    el.checkoutForm.hidden = false;
    el.checkoutToggle.hidden = true;
    document.getElementById('ck-name').focus();
  });

  el.checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!bag.length) return;

    const subtotal = bag.reduce((sum, item) => sum + item.qty * productById.get(item.id).price, 0);
    const delivery = subtotal < BRAND_CONFIG.freeShippingThreshold ? BRAND_CONFIG.shippingFee : 0;

    const lines = [
      'New Gym Gang Order (Drop 01)',
      ...bag.map((item) => {
        const p = productById.get(item.id);
        return `- ${p.name} (${p.sku}, Size ${item.size}) x${item.qty} = ${formatEGP(p.price * item.qty)}`;
      }),
      `Delivery: ${delivery ? formatEGP(delivery) : 'Free'}`,
      `Total: ${formatEGP(subtotal + delivery)}`,
      `Name: ${document.getElementById('ck-name').value.trim()}`,
      `Phone: ${document.getElementById('ck-phone').value.trim()}`,
      `City: ${document.getElementById('ck-city').value}`,
      `Address: ${document.getElementById('ck-address').value.trim()}`,
      `Payment: ${document.querySelector('input[name="payment-method"]:checked').value}`
    ];

    const url = `https://wa.me/${BRAND_CONFIG.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('WhatsApp order formatted — send it to confirm.');
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setDrawerOpen(false);
      closeQuickView();
    }
  });
})();
