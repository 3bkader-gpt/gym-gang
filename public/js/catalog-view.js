(function () {
  const { BRAND_CONFIG, byId, formatCurrency, toast, StorageRepository } = window.GG;

  let catalog = window.GG.PRODUCTS;
  let productById = new Map(catalog.map((p) => [p.id, p]));
  const selectedSizes = new Map(catalog.map((p) => [p.id, p.sizes[0]]));
  const selectedColors = new Map(catalog.map((p) => [p.id, (p.colors && p.colors[0]) || 'Black']));
  let wishlist = StorageRepository.loadWishlist();

  const filters = {
    category: 'all',
    size: '',
    color: '',
    maxPrice: 0,
    sort: 'featured',
    query: ''
  };

  const cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          cardObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );

  function getVariantStock(product, size, color) {
    if (!product || !product.stock) return null;
    const chosenColor = color || (product.colors && product.colors[0]) || 'Black';
    const stock = product.stock[`${size}|${chosenColor}`];
    return stock === undefined ? null : stock;
  }

  function setProducts(newProducts) {
    if (!Array.isArray(newProducts) || !newProducts.length) return;
    catalog = newProducts;
    window.GG.PRODUCTS = catalog;
    productById = new Map(catalog.map((p) => [p.id, p]));
    catalog.forEach((p) => {
      if (!selectedSizes.has(p.id)) selectedSizes.set(p.id, p.sizes[0]);
      if (!selectedColors.has(p.id)) selectedColors.set(p.id, (p.colors && p.colors[0]) || 'Black');
    });
    populateFilterOptions();
    renderCatalog();
  }

  function populateFilterOptions() {
    const sizes = new Set();
    const colors = new Set();
    catalog.forEach((p) => {
      (p.sizes || []).forEach((s) => sizes.add(s));
      (p.colors || ['Black']).forEach((c) => colors.add(c));
    });
    const sizeSelect = byId('filter-size');
    if (sizeSelect) {
      const current = sizeSelect.value;
      sizeSelect.innerHTML = '<option value="">All sizes</option>' + [...sizes].map((s) => `<option value="${s}">${s}</option>`).join('');
      sizeSelect.value = current;
    }
    const colorSelect = byId('filter-color');
    if (colorSelect) {
      const current = colorSelect.value;
      colorSelect.innerHTML = '<option value="">All colors</option>' + [...colors].map((c) => `<option value="${c}">${c}</option>`).join('');
      colorSelect.value = current;
    }
  }

  function matchesFilter(product) {
    if (filters.category === 'fav' && !wishlist.includes(product.id)) return false;
    if (filters.category !== 'all' && filters.category !== 'fav' && product.category !== filters.category) return false;
    if (filters.size && !(product.sizes || []).includes(filters.size)) return false;
    if (filters.color && !(product.colors || ['Black']).includes(filters.color)) return false;
    if (filters.maxPrice > 0 && product.price > filters.maxPrice) return false;
    const q = filters.query.trim().toLowerCase();
    return !q || product.name.toLowerCase().includes(q) || (product.sku && product.sku.toLowerCase().includes(q));
  }

  function sortProducts(list) {
    return [...list].sort((a, b) => {
      if (filters.sort === 'lo' || filters.sort === 'low') return a.price - b.price;
      if (filters.sort === 'hi' || filters.sort === 'high') return b.price - a.price;
      if (filters.sort === 'newest') return b.id - a.id;
      if (filters.sort === 'best') return (b.sold || 0) - (a.sold || 0) || a.id - b.id;
      return (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id);
    });
  }

  function renderCardHtml(product) {
    const currentSize = selectedSizes.get(product.id) || product.sizes[0];
    const currentColor = selectedColors.get(product.id) || (product.colors && product.colors[0]) || 'Black';
    const stock = getVariantStock(product, currentSize, currentColor);
    const isOut = stock !== null && stock <= 0;
    const isLow = stock !== null && stock > 0 && stock <= 4;
    const isSaved = wishlist.includes(product.id);
    const colors = product.colors && product.colors.length ? product.colors : ['Black'];

    return `
      <article class="card rv in" data-id="${product.id}" data-c="${product.category}">
        <div class="im" data-z="${product.id}">
          <img src="${product.image}" alt="${product.name}" decoding="async">
        </div>
        <button type="button" class="hrt" data-h="${product.id}" aria-label="Save ${product.name}" aria-pressed="${isSaved}">
          <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>
        </button>
        <div class="tx">
          <div class="sku-line"><span>${product.sku}</span><span>${product.category === 'acc' ? 'GEAR' : product.category}</span></div>
          <h3 class="d">${product.name}</h3>
          <div class="row">
            <span>${product.compareAt ? `<s class="p-compare">${formatCurrency(product.compareAt)}</s>` : ''}<b>${formatCurrency(product.price)}</b></span>
          </div>
          <p class="sum">${product.summary}</p>
          ${
            colors.length > 1
              ? `<div class="sz" data-col-id="${product.id}" style="margin-bottom:8px">
                  ${colors.map((c) => `<button type="button" data-color="${c}" aria-pressed="${c === currentColor}">${c}</button>`).join('')}
                </div>`
              : ''
          }
          <div class="sz" data-i="${product.id}">
            ${product.sizes.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === currentSize}">${s}</button>`).join('')}
          </div>
          ${
            isOut
              ? '<p class="stock-note stock-note--out">Sold out in this size</p>'
              : isLow
              ? `<p class="stock-note">Only ${stock} left in ${currentSize}</p>`
              : ''
          }
          <button type="button" class="add" data-i="${product.id}" ${isOut ? 'disabled' : ''}>${isOut ? 'Out of stock' : 'Add to cart'}</button>
        </div>
      </article>`;
  }

  function renderCatalog() {
    const visible = sortProducts(catalog.filter(matchesFilter));
    byId('catalog-count').textContent = `${visible.length} ${visible.length === 1 ? 'piece' : 'pieces'}`;
    byId('no-results').hidden = visible.length > 0;
    byId('fc').textContent = String(wishlist.length);
    byId('products').innerHTML = visible.map(renderCardHtml).join('');
    document.querySelectorAll('#products .card').forEach((card) => cardObserver.observe(card));
  }

  function toggleWishlistItem(productId, buttonEl) {
    const index = wishlist.indexOf(productId);
    if (index > -1) wishlist.splice(index, 1);
    else wishlist.push(productId);
    window.GG.CartDrawer?.persistState();
    byId('fc').textContent = String(wishlist.length);
    toast(index < 0 ? 'Saved to your list' : 'Removed from your list');
    if (filters.category === 'fav') renderCatalog();
    else if (buttonEl) buttonEl.setAttribute('aria-pressed', String(index < 0));
  }

  function applyRecommendedSizes(teeSize, hoodieSize) {
    const tee = catalog.find((p) => p.sku === 'GG-01') || catalog[0];
    const hoodie = catalog.find((p) => p.sku === 'GG-04') || catalog[3];
    if (tee) selectedSizes.set(tee.id, teeSize);
    if (hoodie) selectedSizes.set(hoodie.id, hoodieSize);
    renderCatalog();
    toast(`Sizes selected: Tee ${teeSize} · Hoodie ${hoodieSize}`);
  }

  function bindFilterControls() {
    document.querySelector('.flt').addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.k === 'fav' && !wishlist.length) {
        toast('Tap the heart on any piece to save it');
        return;
      }
      filters.category = btn.dataset.k;
      this.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderCatalog();
    });

    byId('search-input').oninput = (e) => { filters.query = e.target.value; renderCatalog(); };
    byId('filter-size').onchange = (e) => { filters.size = e.target.value; renderCatalog(); };
    byId('filter-color').onchange = (e) => { filters.color = e.target.value; renderCatalog(); };
    byId('filter-price').onchange = (e) => { filters.maxPrice = Number(e.target.value) || 0; renderCatalog(); };
    byId('srt').onchange = (e) => { filters.sort = e.target.value; renderCatalog(); };
  }

  populateFilterOptions();
  renderCatalog();
  bindFilterControls();

  window.GG.CatalogView = {
    getCatalog: () => catalog,
    getProduct: (id) => productById.get(id),
    getSelectedSize: (id) => selectedSizes.get(id),
    getSelectedColor: (id) => selectedColors.get(id),
    setSelectedSize: (id, size) => { selectedSizes.set(id, size); renderCatalog(); },
    setSelectedColor: (id, color) => { selectedColors.set(id, color); renderCatalog(); },
    getWishlist: () => wishlist,
    getVariantStock,
    setProducts,
    renderCatalog,
    toggleWishlistItem
  };
  window.GG.applyRecommendedSizes = applyRecommendedSizes;
})();
