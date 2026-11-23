(function () {
  const { BRAND_CONFIG, PROMOS, byId, formatCurrency, toast, clank, StorageRepository, StoreApiClient, CatalogView } = window.GG;

  let cart = StorageRepository.loadCart();
  let promoCode = StorageRepository.loadPromoCode();
  let promoPercent = PROMOS[promoCode] || 0;

  function persistState() {
    StorageRepository.saveAll(cart, CatalogView.getWishlist(), promoCode);
  }

  function getQuantityInCart(productId, size, color) {
    const item = cart.find((c) => c.id === productId && c.size === size && c.color === color);
    return item ? item.qty : 0;
  }

  function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => {
      const product = CatalogView.getProduct(item.id);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
    const discount = Math.round((subtotal * (promoPercent || 0)) / 100);
    const shipping = subtotal && subtotal < BRAND_CONFIG.freeShippingThreshold ? BRAND_CONFIG.shippingFee : 0;
    return { subtotal, discount, shipping, total: subtotal - discount + shipping };
  }

  function getEstimatedDeliveryRange() {
    const formatDay = (daysAhead) => {
      const date = new Date();
      date.setDate(date.getDate() + daysAhead);
      return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    return `${formatDay(2)} to ${formatDay(4)}`;
  }

  function renderUpsellSuggestion(subtotal) {
    const upsellBox = byId('ups');
    if (!upsellBox || !subtotal) {
      if (upsellBox) upsellBox.innerHTML = '';
      return;
    }
    const gap = BRAND_CONFIG.freeShippingThreshold - subtotal;
    const inCartIds = new Set(cart.map((c) => c.id));
    let candidate = null;
    CatalogView.getCatalog().forEach((product) => {
      const stock = CatalogView.getVariantStock(product, product.sizes[0], (product.colors && product.colors[0]) || 'Black');
      if (stock !== null && stock <= 0) return;
      if (inCartIds.has(product.id) || product.sizes.length > 1 || (gap > 0 && product.price < gap)) return;
      if (!candidate || product.price < candidate.price) candidate = product;
    });

    upsellBox.innerHTML = candidate
      ? `<div class="up">
          <img src="${candidate.image}" alt="">
          <div>
            <small>${gap > 0 ? 'Add this for free delivery' : 'Complete your set'}</small>
            <b>${candidate.name}</b> &middot; ${formatCurrency(candidate.price)}
          </div>
          <button type="button" data-u="${candidate.id}">Add</button>
        </div>`
      : '';
  }

  function renderCart() {
    cart = cart.filter((item) => CatalogView.getProduct(item.id) && item.qty > 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const { subtotal, discount, shipping, total } = calculateTotals();

    byId('n').textContent = String(itemCount);
    byId('cart').classList.toggle('full', itemCount > 0);
    byId('sub').textContent = formatCurrency(subtotal);
    byId('dl').textContent = subtotal ? (shipping ? formatCurrency(shipping) : 'Free') : '-';
    byId('dsr').hidden = !discount;
    byId('dsl').textContent = promoCode ? `Promo ${promoCode}` : 'Promo';
    byId('dsv').textContent = `-${formatCurrency(discount)}`;
    byId('tt').textContent = formatCurrency(total);

    byId('bf').style.width = `${Math.min(100, (subtotal / BRAND_CONFIG.freeShippingThreshold) * 100)}%`;
    byId('ship').textContent = !subtotal
      ? 'Your cart is empty. Add a piece from the drop.'
      : subtotal >= BRAND_CONFIG.freeShippingThreshold
      ? 'You’ve got free delivery.'
      : `Add ${formatCurrency(BRAND_CONFIG.freeShippingThreshold - subtotal)} more for free delivery.`;
    byId('eta').textContent = subtotal ? `Estimated delivery: ${getEstimatedDeliveryRange()}` : '';
    byId('pmsg').textContent = promoCode ? `${promoCode} applied${discount ? `. You save ${formatCurrency(discount)}` : ''}` : '';

    byId('items').innerHTML = cart
      .map((item, idx) => {
        const product = CatalogView.getProduct(item.id);
        return `
          <div class="it">
            <img src="${product.image}" alt="">
            <div>
              <b>${product.name}</b><br>
              <small>${product.sku} &middot; ${item.size}${item.color && item.color !== 'Black' ? ` &middot; ${item.color}` : ''}</small>
              <div class="q">
                <button type="button" data-m="${idx}" aria-label="Less">−</button>
                ${item.qty}
                <button type="button" data-p="${idx}" aria-label="More">+</button>
              </div>
            </div>
            <div style="text-align:right">
              ${formatCurrency(product.price * item.qty)}<br>
              <button type="button" class="lnk" data-r="${idx}">Remove</button>
            </div>
          </div>`;
      })
      .join('');

    if (!subtotal) {
      byId('co').hidden = true;
      byId('ck').hidden = true;
    } else {
      byId('co').hidden = !byId('ck').hidden;
    }

    renderUpsellSuggestion(subtotal);
    persistState();
  }

  function animateFlyToCart(addBtn) {
    const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const originalLabel = addBtn.textContent;
    addBtn.textContent = 'Added ✓';
    addBtn.classList.add('ok2');
    setTimeout(() => {
      addBtn.textContent = originalLabel;
      addBtn.classList.remove('ok2');
    }, 1100);
    if (reducedMotion) return;

    document.querySelector('nav').classList.remove('hd');
    const btnRect = addBtn.getBoundingClientRect();
    const cx = btnRect.left + btnRect.width / 2;
    const cy = btnRect.top + btnRect.height / 2;
    for (let i = 0; i < 14; i += 1) {
      const spark = document.createElement('span');
      const angle = (i / 14) * 6.283;
      const dist = 40 + Math.random() * 50;
      spark.style.cssText = `position:fixed;z-index:96;pointer-events:none;width:6px;height:6px;border-radius:50%;background:#C8A45C;left:${cx}px;top:${cy}px`;
      document.body.appendChild(spark);
      spark.animate(
        [{ transform: 'none', opacity: 1 }, { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(.2)`, opacity: 0 }],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
      setTimeout(() => spark.remove(), 700);
    }

    const card = addBtn.closest('.card');
    if (!card) return;
    const imgRect = card.querySelector('img').getBoundingClientRect();
    const cartRect = byId('cart').getBoundingClientRect();
    const flyer = document.createElement('img');
    flyer.alt = '';
    flyer.src = card.querySelector('img').src;
    flyer.style.cssText = `position:fixed;z-index:80;pointer-events:none;width:90px;height:90px;object-fit:cover;border:1px solid #A99C8A;left:${imgRect.left + imgRect.width / 2 - 45}px;top:${imgRect.top + imgRect.height / 2 - 45}px`;
    document.body.appendChild(flyer);
    flyer.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${cartRect.left + cartRect.width / 2 - imgRect.left - imgRect.width / 2}px,${cartRect.top + cartRect.height / 2 - imgRect.top - imgRect.height / 2}px) scale(.25)`, opacity: 0.3 }
      ],
      { duration: 700, easing: 'cubic-bezier(.5,0,.8,.4)' }
    ).onfinish = () => flyer.remove();
  }

  function addItem(productId, size, color, triggerBtn) {
    const product = CatalogView.getProduct(productId);
    if (!product) return;
    const chosenSize = size || CatalogView.getSelectedSize(productId) || product.sizes[0];
    const chosenColor = color || CatalogView.getSelectedColor(productId) || (product.colors && product.colors[0]) || 'Black';
    const maxStock = CatalogView.getVariantStock(product, chosenSize, chosenColor);
    const inCart = getQuantityInCart(productId, chosenSize, chosenColor);

    if (maxStock !== null && inCart >= maxStock) {
      toast(maxStock <= 0 ? `${product.name} (${chosenSize}) is out of stock` : `Max available stock (${maxStock}) reached`);
      return;
    }

    const existing = cart.find((c) => c.id === productId && c.size === chosenSize && c.color === chosenColor);
    if (existing) existing.qty += 1;
    else cart.push({ id: productId, size: chosenSize, color: chosenColor, qty: 1 });

    renderCart();
    clank(420);
    const cartBtn = byId('cart');
    cartBtn.classList.remove('bump');
    void cartBtn.offsetWidth;
    cartBtn.classList.add('bump');
    toast(`${product.name} (${chosenSize}) added to your cart`);
    if (triggerBtn) animateFlyToCart(triggerBtn);
  }

  function setDrawerOpen(isOpen) {
    byId('dr').classList.toggle('on', isOpen);
    byId('ov').classList.toggle('on', isOpen);
  }

  async function applyPromoFromInput() {
    const code = byId('pc2').value.trim().toUpperCase();
    byId('pc2').value = '';
    if (!code) return;
    const { subtotal } = calculateTotals();

    if (StoreApiClient.isOnlineMode()) {
      try {
        const res = await StoreApiClient.validatePromo(code, subtotal);
        promoCode = res.code;
        promoPercent = res.percent;
        PROMOS[promoCode] = promoPercent;
        renderCart();
        toast(`${promoCode} applied`);
        return;
      } catch (err) {
        promoCode = '';
        promoPercent = 0;
        renderCart();
        byId('pmsg').textContent = err.message;
        return;
      }
    }

    if (PROMOS[code]) {
      promoCode = code;
      promoPercent = PROMOS[code];
      renderCart();
      toast(`${code} applied`);
    } else {
      promoCode = '';
      promoPercent = 0;
      renderCart();
      byId('pmsg').textContent = 'That code is not valid.';
    }
  }

  async function handleCheckoutSubmit(e) {
    e.preventDefault();
    if (!cart.length) return;
    const submitBtn = byId('ck').querySelector('button[type="submit"]');
    const payload = {
      customer: {
        name: byId('nm').value.trim(),
        phone: byId('ph').value.trim(),
        email: (byId('em2')?.value || '').trim() || undefined
      },
      governorate: byId('ct').value,
      address: byId('ad').value.trim(),
      notes: (byId('nt')?.value || '').trim() || undefined,
      paymentMethod: document.querySelector('[name="pm"]:checked').value,
      promoCode: promoCode || undefined,
      items: cart.map((c) => ({ productId: c.id, size: c.size, color: c.color, qty: c.qty }))
    };

    if (StoreApiClient.isOnlineMode()) {
      submitBtn.disabled = true;
      const origText = submitBtn.textContent;
      submitBtn.textContent = 'Saving order...';
      try {
        const data = await StoreApiClient.createOrder(payload);
        cart = [];
        renderCart();
        window.GG.hydrateStoreFromApi?.();
        if (data.paymentUrl) {
          toast(`Order ${data.order.code} saved — redirecting to Paymob...`);
          window.location.href = data.paymentUrl;
          return;
        }
        window.open(`https://wa.me/${data.whatsapp.number}?text=${encodeURIComponent(data.whatsapp.text)}`, '_blank', 'noopener,noreferrer');
        toast(`Order ${data.order.code} saved! Send on WhatsApp to confirm.`);
      } catch (err) {
        toast(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
      return;
    }

    const { discount, shipping, total } = calculateTotals();
    const id = `GG-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const msg =
      `New Gym Gang order ${id}\n` +
      cart.map((c) => `- ${CatalogView.getProduct(c.id).name} (${c.size}) x${c.qty} = ${formatCurrency(CatalogView.getProduct(c.id).price * c.qty)}`).join('\n') +
      (discount ? `\nPromo ${promoCode}: -${formatCurrency(discount)}` : '') +
      `\nDelivery: ${shipping ? formatCurrency(shipping) : 'Free'}\nTotal: ${formatCurrency(total)}\nName: ${payload.customer.name}\nPhone: ${payload.customer.phone}\nCity: ${payload.governorate}\nAddress: ${payload.address}\nPayment: ${payload.paymentMethod}`;
    window.open(`https://wa.me/${BRAND_CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    toast(`Order ${id} ready. Send it on WhatsApp to confirm.`);
  }

  window.GG.applyPromo = function applyPromo(code, pct = 10) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return false;
    promoCode = clean;
    promoPercent = PROMOS[clean] || pct;
    PROMOS[clean] = promoPercent;
    renderCart();
    return true;
  };

  byId('cart').onclick = () => setDrawerOpen(true);
  byId('co').onclick = () => { byId('ck').hidden = false; byId('co').hidden = true; byId('nm').focus(); };
  byId('pa').onclick = applyPromoFromInput;
  byId('ck').onsubmit = handleCheckoutSubmit;

  renderCart();
  window.GG.CartDrawer = { addItem, renderCart, setDrawerOpen, persistState, changeQty(index, delta) {
    const item = cart[index];
    if (!item) return;
    if (delta > 0) {
      const maxStock = CatalogView.getVariantStock(CatalogView.getProduct(item.id), item.size, item.color);
      if (maxStock !== null && item.qty >= maxStock) { toast(`Only ${maxStock} available in stock`); return; }
    }
    item.qty += delta;
    if (item.qty <= 0) cart.splice(index, 1);
    renderCart();
  }, removeItem(index) { cart.splice(index, 1); renderCart(); } };
})();
