(function () {
  const { BRAND_CONFIG, PROMOS } = window.GG;
  let PRODUCTS = window.GG.PRODUCTS;
  const $ = (id) => document.getElementById(id);
  const F = (n) => `${Number(n || 0).toLocaleString('en-US')} EGP`;

  let productById = new Map(PRODUCTS.map((p) => [p.id, p]));
  const selectedSizes = new Map(PRODUCTS.map((p) => [p.id, p.sizes[0]]));
  const selectedColors = new Map(PRODUCTS.map((p) => [p.id, (p.colors && p.colors[0]) || 'Black']));

  let cart = loadCart();
  let wish = loadWish();
  let promo = loadPromo();
  let promoPercent = PROMOS[promo] || 0;
  let activeFilter = 'all';
  let activeSizeFilter = '';
  let activeColorFilter = '';
  let maxPriceFilter = 0;
  let activeSort = 'featured';
  let query = '';
  let soundOn = false;
  let AC = null;

  function clank(f) {
    if (!soundOn) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime;
      [f, f * 2.7, f * 4.1].forEach((fr, i) => {
        const o = AC.createOscillator();
        const g = AC.createGain();
        o.type = i ? 'sine' : 'triangle';
        o.frequency.value = fr;
        g.gain.setValueAtTime(0.16 / (i + 1), t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.45);
        o.connect(g);
        g.connect(AC.destination);
        o.start(t);
        o.stop(t + 0.5);
      });
    } catch {
      // Audio blocked
    }
  }
  window.GG.clank = clank;

  function toast(t) {
    const o = $('toast');
    if (!o) return;
    o.textContent = t;
    o.classList.add('on');
    clearTimeout(o._t);
    o._t = setTimeout(() => o.classList.remove('on'), 2100);
  }
  window.GG.toast = toast;

  function getVariantStock(p, size, color) {
    if (!p || !p.stock) return null;
    const col = color || (p.colors && p.colors[0]) || 'Black';
    const val = p.stock[`${size}|${col}`];
    return val === undefined ? null : val;
  }

  function qtyInCart(id, size, color) {
    const item = cart.find((c) => c.id === id && c.size === size && c.color === color);
    return item ? item.qty : 0;
  }

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BRAND_CONFIG.storageKey) || '[]');
      return Array.isArray(parsed)
        ? parsed
            .filter((c) => c && c.qty > 0)
            .map((c) => ({
              id: Number(c.id),
              size: c.size || 'S',
              color: c.color || 'Black',
              qty: Number(c.qty)
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

  function saveState() {
    try {
      localStorage.setItem(BRAND_CONFIG.storageKey, JSON.stringify(cart));
      localStorage.setItem(BRAND_CONFIG.wishKey, JSON.stringify(wish));
      localStorage.setItem(BRAND_CONFIG.promoKey, promo);
    } catch {
      // Storage unavailable
    }
  }

  function populateFilterDropdowns() {
    const allSizes = new Set();
    const allColors = new Set();
    PRODUCTS.forEach((p) => {
      (p.sizes || []).forEach((s) => allSizes.add(s));
      (p.colors || ['Black']).forEach((c) => allColors.add(c));
    });
    const sf = $('filter-size');
    if (sf) {
      const cur = sf.value;
      sf.innerHTML = '<option value="">All sizes</option>' + [...allSizes].map((s) => `<option value="${s}">${s}</option>`).join('');
      sf.value = cur;
    }
    const cf = $('filter-color');
    if (cf) {
      const cur = cf.value;
      cf.innerHTML = '<option value="">All colors</option>' + [...allColors].map((c) => `<option value="${c}">${c}</option>`).join('');
      cf.value = cur;
    }
  }

  function populateGovernorates() {
    const ct = $('ct');
    if (!ct) return;
    const govs = BRAND_CONFIG.governorates || ['Cairo', 'Giza', 'Alexandria'];
    ct.innerHTML = govs.map((g) => `<option value="${g}">${g}</option>`).join('');
  }

  function renderSizeGuideTable() {
    const tb = $('guide-table-body');
    if (!tb) return;
    const rows = BRAND_CONFIG.sizeGuide || [];
    let prev = null;
    tb.innerHTML = rows
      .map((r, i) => {
        const label =
          i === 0
            ? `Under ${r.below} kg`
            : r.below === null
            ? `${prev} kg and above`
            : `${prev} to ${r.below - 1} kg`;
        prev = r.below;
        return `<tr><td><b>${r.size}</b></td><td>${label}</td></tr>`;
      })
      .join('');
    const note = $('guide-note-text');
    if (note) {
      note.textContent = `Taller than ${BRAND_CONFIG.tallCm} cm? Go one size up. ${BRAND_CONFIG.shortCm} cm or shorter? Go one size down. Between sizes? Size up.`;
    }
  }

  function updateWhatsAppLinks() {
    const wa = BRAND_CONFIG.whatsapp || '201010565783';
    const floatWa = $('wa');
    if (floatWa) floatWa.href = `https://wa.me/${wa}?text=${encodeURIComponent('Hi Gym Gang, I need help with my order / size.')}`;
    const cWa = $('contact-wa-link');
    if (cWa) cWa.href = `https://wa.me/${wa}?text=${encodeURIComponent('Hi Gym Gang!')}`;
    const cTel = $('contact-tel-link');
    if (cTel) cTel.href = `tel:+${wa}`;
  }

  const cardIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          cardIO.unobserve(en.target);
        }
      });
    },
    { threshold: 0.08 }
  );

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
      if (activeSort === 'lo' || activeSort === 'low') return a.price - b.price;
      if (activeSort === 'hi' || activeSort === 'high') return b.price - a.price;
      if (activeSort === 'newest') return b.id - a.id;
      if (activeSort === 'best') return (b.sold || 0) - (a.sold || 0) || a.id - b.id;
      return (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id);
    });

    $('catalog-count').textContent = `${sorted.length} ${sorted.length === 1 ? 'piece' : 'pieces'}`;
    $('no-results').hidden = sorted.length > 0;
    $('fc').textContent = String(wish.length);

    $('products').innerHTML = sorted
      .map((x) => {
        const curSize = selectedSizes.get(x.id) || x.sizes[0];
        const curColor = selectedColors.get(x.id) || (x.colors && x.colors[0]) || 'Black';
        const stock = getVariantStock(x, curSize, curColor);
        const oos = stock !== null && stock <= 0;
        const low = stock !== null && stock > 0 && stock <= 4;
        const saved = wish.includes(x.id);
        const colors = x.colors && x.colors.length ? x.colors : ['Black'];

        return `
          <article class="card rv in" data-id="${x.id}" data-c="${x.category}">
            <div class="im" data-z="${x.id}">
              <img src="${x.image}" alt="${x.name}" decoding="async">
            </div>
            <button type="button" class="hrt" data-h="${x.id}" aria-label="Save ${x.name}" aria-pressed="${saved}">
              <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>
            </button>
            <div class="tx">
              <div class="sku-line"><span>${x.sku}</span><span>${x.category === 'acc' ? 'GEAR' : x.category}</span></div>
              <h3 class="d">${x.name}</h3>
              <div class="row">
                <span>${x.compareAt ? `<s class="p-compare">${F(x.compareAt)}</s>` : ''}<b>${F(x.price)}</b></span>
              </div>
              <p class="sum">${x.summary}</p>
              ${
                colors.length > 1
                  ? `<div class="sz" data-col-id="${x.id}" style="margin-bottom:8px">
                      ${colors.map((c) => `<button type="button" data-color="${c}" aria-pressed="${c === curColor}">${c}</button>`).join('')}
                    </div>`
                  : ''
              }
              <div class="sz" data-i="${x.id}">
                ${x.sizes.map((z) => `<button type="button" data-size="${z}" aria-pressed="${z === curSize}">${z}</button>`).join('')}
              </div>
              ${
                oos
                  ? '<p class="stock-note stock-note--out">Sold out in this size</p>'
                  : low
                  ? `<p class="stock-note">Only ${stock} left in ${curSize}</p>`
                  : ''
              }
              <button type="button" class="add" data-i="${x.id}" ${oos ? 'disabled' : ''}>${oos ? 'Out of stock' : 'Add to cart'}</button>
            </div>
          </article>`;
      })
      .join('');

    document.querySelectorAll('#products .card').forEach((c) => cardIO.observe(c));
  }

  function eta() {
    const f = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    return `${f(2)} to ${f(4)}`;
  }

  function getTotals() {
    const sub = cart.reduce((sum, c) => {
      const p = productById.get(c.id);
      return sum + (p ? p.price * c.qty : 0);
    }, 0);
    const ds = Math.round((sub * (promoPercent || 0)) / 100);
    const sh = sub && sub < BRAND_CONFIG.freeShippingThreshold ? BRAND_CONFIG.shippingFee : 0;
    return { sub, ds, sh, total: sub - ds + sh };
  }

  function renderUpsell(sub) {
    const u = $('ups');
    if (!u) return;
    if (!sub) {
      u.innerHTML = '';
      return;
    }
    const gap = BRAND_CONFIG.freeShippingThreshold - sub;
    const inC = new Set(cart.map((c) => c.id));
    let best = null;
    PRODUCTS.forEach((x) => {
      const st = getVariantStock(x, x.sizes[0], (x.colors && x.colors[0]) || 'Black');
      if (st !== null && st <= 0) return;
      if (inC.has(x.id) || x.sizes.length > 1 || (gap > 0 && x.price < gap)) return;
      if (!best || x.price < best.price) best = x;
    });
    if (!best) {
      u.innerHTML = '';
      return;
    }
    u.innerHTML = `
      <div class="up">
        <img src="${best.image}" alt="">
        <div>
          <small>${gap > 0 ? 'Add this for free delivery' : 'Complete your set'}</small>
          <b>${best.name}</b> &middot; ${F(best.price)}
        </div>
        <button type="button" data-u="${best.id}">Add</button>
      </div>`;
  }

  function renderCart() {
    cart = cart.filter((c) => productById.has(c.id) && c.qty > 0);
    const n = cart.reduce((sum, c) => sum + c.qty, 0);
    const { sub, ds, sh, total } = getTotals();

    $('n').textContent = String(n);
    $('cart').classList.toggle('full', n > 0);
    $('sub').textContent = F(sub);
    $('dl').textContent = sub ? (sh ? F(sh) : 'Free') : '-';
    $('dsr').hidden = !ds;
    $('dsl').textContent = promo ? `Promo ${promo}` : 'Promo';
    $('dsv').textContent = `-${F(ds)}`;
    $('tt').textContent = F(total);

    $('bf').style.width = `${Math.min(100, (sub / BRAND_CONFIG.freeShippingThreshold) * 100)}%`;
    $('ship').textContent = !sub
      ? 'Your cart is empty. Add a piece from the drop.'
      : sub >= BRAND_CONFIG.freeShippingThreshold
      ? 'You’ve got free delivery.'
      : `Add ${F(BRAND_CONFIG.freeShippingThreshold - sub)} more for free delivery.`;
    $('eta').textContent = sub ? `Estimated delivery: ${eta()}` : '';
    $('pmsg').textContent = promo ? `${promo} applied${ds ? `. You save ${F(ds)}` : ''}` : '';

    $('items').innerHTML = cart
      .map((c, k) => {
        const x = productById.get(c.id);
        return `
          <div class="it">
            <img src="${x.image}" alt="">
            <div>
              <b>${x.name}</b><br>
              <small>${x.sku} &middot; ${c.size}${c.color && c.color !== 'Black' ? ` &middot; ${c.color}` : ''}</small>
              <div class="q">
                <button type="button" data-m="${k}" aria-label="Less">−</button>
                ${c.qty}
                <button type="button" data-p="${k}" aria-label="More">+</button>
              </div>
            </div>
            <div style="text-align:right">
              ${F(x.price * c.qty)}<br>
              <button type="button" class="lnk" data-r="${k}">Remove</button>
            </div>
          </div>`;
      })
      .join('');

    if (!sub) {
      $('co').hidden = true;
      $('ck').hidden = true;
    } else {
      $('co').hidden = !$('ck').hidden;
    }

    renderUpsell(sub);
    saveState();
  }

  function openCart(o) {
    $('dr').classList.toggle('on', o);
    $('ov').classList.toggle('on', o);
  }

  function animateAddToCart(addBtn) {
    const rm = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const t0 = addBtn.textContent;
    addBtn.textContent = 'Added ✓';
    addBtn.classList.add('ok2');
    setTimeout(() => {
      addBtn.textContent = t0;
      addBtn.classList.remove('ok2');
    }, 1100);

    if (rm) return;
    document.querySelector('nav').classList.remove('hd');

    // 14 gold sparks burst
    const br = addBtn.getBoundingClientRect();
    const x0 = br.left + br.width / 2;
    const y0 = br.top + br.height / 2;
    for (let i = 0; i < 14; i += 1) {
      const s = document.createElement('span');
      const an = (i / 14) * 6.283;
      const d = 40 + Math.random() * 50;
      s.style.cssText = `position:fixed;z-index:96;pointer-events:none;width:6px;height:6px;border-radius:50%;background:#C8A45C;left:${x0}px;top:${y0}px`;
      document.body.appendChild(s);
      s.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${Math.cos(an) * d}px,${Math.sin(an) * d}px) scale(.2)`, opacity: 0 }
        ],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
      setTimeout(() => s.remove(), 700);
    }

    // Fly-to-cart thumbnail
    const card = addBtn.closest('.card');
    if (!card) return;
    const im2 = card.querySelector('img');
    const c = $('cart');
    const r = im2.getBoundingClientRect();
    const t = c.getBoundingClientRect();
    const f = document.createElement('img');
    f.alt = '';
    f.src = im2.src;
    f.style.cssText = `position:fixed;z-index:80;pointer-events:none;width:90px;height:90px;object-fit:cover;border:1px solid #A99C8A;left:${r.left + r.width / 2 - 45}px;top:${r.top + r.height / 2 - 45}px`;
    document.body.appendChild(f);
    f.animate(
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${t.left + t.width / 2 - r.left - r.width / 2}px,${t.top + t.height / 2 - r.top - r.height / 2}px) scale(.25)`,
          opacity: 0.3
        }
      ],
      { duration: 700, easing: 'cubic-bezier(.5,0,.8,.4)' }
    ).onfinish = () => f.remove();
  }

  function addItem(id, size, color, triggerBtn) {
    const p = productById.get(id);
    if (!p) return;
    const sz = size || selectedSizes.get(id) || p.sizes[0];
    const col = color || selectedColors.get(id) || (p.colors && p.colors[0]) || 'Black';
    const maxStock = getVariantStock(p, sz, col);
    const inC = qtyInCart(id, sz, col);

    if (maxStock !== null && inC >= maxStock) {
      toast(maxStock <= 0 ? `${p.name} (${sz}) is out of stock` : `Max available stock (${maxStock}) reached`);
      return;
    }

    const existing = cart.find((c) => c.id === id && c.size === sz && c.color === col);
    if (existing) existing.qty += 1;
    else cart.push({ id, size: sz, color: col, qty: 1 });

    renderCart();
    clank(420);
    const k = $('cart');
    k.classList.remove('bump');
    void k.offsetWidth;
    k.classList.add('bump');
    toast(`${p.name} (${sz}) added to your cart`);
    if (triggerBtn) animateAddToCart(triggerBtn);
  }

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
      html: `<p><b>Nationwide Delivery:</b> 2–4 business days across all 27 Egyptian governorates. Flat shipping is ${F(BRAND_CONFIG.shippingFee)} and free on orders of ${F(BRAND_CONFIG.freeShippingThreshold)} or more.</p><p><b>7-Day Size Exchange:</b> Message us on WhatsApp within 7 days of delivery with unworn gear and we will arrange a quick size exchange.</p>`
    }
  };

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
        const pmWrap = $('paymob-option-wrap');
        if (pmWrap) pmWrap.hidden = !(cfg.paymentMethods && cfg.paymentMethods.paymob);
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
          renderCart();
        }
      }
    } catch {
      // Offline fallback active
    }
  }

  window.GG.applyRecommendedSizes = function applyRecommendedSizes(teeSize, hoodieSize) {
    const tee = PRODUCTS.find((p) => p.sku === 'GG-01') || PRODUCTS[0];
    const hoodie = PRODUCTS.find((p) => p.sku === 'GG-04') || PRODUCTS[3];
    if (tee) selectedSizes.set(tee.id, teeSize);
    if (hoodie) selectedSizes.set(hoodie.id, hoodieSize);
    renderCatalog();
    toast(`Sizes selected: Tee ${teeSize} · Hoodie ${hoodieSize}`);
  };

  window.GG.applyPromo = function applyPromo(code, pct = 10) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return false;
    promo = clean;
    promoPercent = PROMOS[clean] || pct;
    PROMOS[clean] = promoPercent;
    renderCart();
    return true;
  };

  // Initial render
  $('tk').innerHTML = Array(15).join('<span>BUILT TOGETHER &nbsp;&#10022;&nbsp; STRENGTH IN UNITY &nbsp;&#10022;&nbsp; BUILT DIFFERENT &nbsp;&#10022;&nbsp; </span>');
  $('tk2').innerHTML = Array(15).join('<span>DISCIPLINE &nbsp;&#10022;&nbsp; CONSISTENCY &nbsp;&#10022;&nbsp; COMMUNITY &nbsp;&#10022;&nbsp; </span>');

  populateFilterDropdowns();
  populateGovernorates();
  renderSizeGuideTable();
  updateWhatsAppLinks();
  renderCatalog();
  renderCart();
  syncFromBackend();

  const rvIO = new IntersectionObserver(
    (es) => {
      es.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          rvIO.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll('.rv').forEach((el) => rvIO.observe(el));

  // Self-drawing trust icons
  const tr = document.querySelector('.tr2');
  if (tr) {
    tr.querySelectorAll('svg *').forEach((n) => n.setAttribute('pathLength', 1));
    new IntersectionObserver(
      (es, o) => {
        es.forEach((en) => {
          if (en.isIntersecting) {
            tr.classList.add('go');
            o.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    ).observe(tr);
  }

  // Event listeners
  $('snd').onclick = function () {
    soundOn = !soundOn;
    this.setAttribute('aria-pressed', String(soundOn));
    this.textContent = soundOn ? 'Sound on' : 'Sound off';
    clank(520);
  };

  document.querySelector('.flt').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k === 'fav' && !wish.length) {
      toast('Tap the heart on any piece to save it');
      return;
    }
    activeFilter = b.dataset.k;
    this.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderCatalog();
  });

  $('search-input').oninput = function () {
    query = this.value;
    renderCatalog();
  };
  $('filter-size').onchange = function () {
    activeSizeFilter = this.value;
    renderCatalog();
  };
  $('filter-color').onchange = function () {
    activeColorFilter = this.value;
    renderCatalog();
  };
  $('filter-price').onchange = function () {
    maxPriceFilter = Number(this.value) || 0;
    renderCatalog();
  };
  $('srt').onchange = function () {
    activeSort = this.value;
    renderCatalog();
  };

  document.addEventListener('click', (e) => {
    const t = e.target;
    let a;
    if ((a = t.closest('.hrt'))) {
      const id = Number(a.dataset.h);
      const k = wish.indexOf(id);
      if (k > -1) wish.splice(k, 1);
      else wish.push(id);
      saveState();
      $('fc').textContent = String(wish.length);
      toast(k < 0 ? 'Saved to your list' : 'Removed from your list');
      if (activeFilter === 'fav') renderCatalog();
      else a.setAttribute('aria-pressed', String(k < 0));
    } else if ((a = t.closest('.sz[data-i] button'))) {
      const id = Number(a.parentNode.dataset.i);
      selectedSizes.set(id, a.dataset.size || a.textContent);
      renderCatalog();
    } else if ((a = t.closest('.sz[data-col-id] button'))) {
      const id = Number(a.parentNode.dataset.colId);
      selectedColors.set(id, a.dataset.color || a.textContent);
      renderCatalog();
    } else if ((a = t.closest('.add'))) {
      const id = Number(a.dataset.i);
      addItem(id, selectedSizes.get(id), selectedColors.get(id), a);
    } else if ((a = t.closest('[data-u]'))) {
      const id = Number(a.dataset.u);
      const p = productById.get(id);
      if (p) addItem(id, p.sizes[0], (p.colors && p.colors[0]) || 'Black');
    } else if ((a = t.closest('[data-z]'))) {
      const p = productById.get(Number(a.dataset.z));
      if (p) {
        $('lbi').src = p.image;
        $('lbt').textContent = `${p.name} — ${F(p.price)} (${(p.specs || []).join(' · ')})`;
        $('lb').classList.add('on');
      }
    } else if (t.closest('#lb')) {
      $('lb').classList.remove('on');
    } else if ((a = t.closest('[data-p]'))) {
      const item = cart[Number(a.dataset.p)];
      const p = productById.get(item.id);
      const maxStock = getVariantStock(p, item.size, item.color);
      if (maxStock !== null && item.qty >= maxStock) {
        toast(`Only ${maxStock} available in stock`);
        return;
      }
      item.qty += 1;
      renderCart();
    } else if ((a = t.closest('[data-m]'))) {
      const idx = Number(a.dataset.m);
      cart[idx].qty -= 1;
      if (cart[idx].qty <= 0) cart.splice(idx, 1);
      renderCart();
    } else if ((a = t.closest('[data-r]'))) {
      cart.splice(Number(a.dataset.r), 1);
      renderCart();
    } else if (t.closest('#x') || t.id === 'ov') {
      openCart(false);
    } else if ((a = t.closest('[data-policy]'))) {
      e.preventDefault();
      const pol = POLICIES[a.dataset.policy];
      if (pol) {
        $('pmo-title').textContent = pol.title;
        $('pmo-body').innerHTML = pol.html;
        $('pmo').hidden = false;
      }
    }
  });

  $('cart').onclick = () => openCart(true);
  $('co').onclick = () => {
    $('ck').hidden = false;
    $('co').hidden = true;
    $('nm').focus();
  };

  $('sgb').onclick = () => {
    $('sgm').hidden = false;
  };
  $('sgx').onclick = () => {
    $('sgm').hidden = true;
  };
  $('sgf').onclick = () => {
    $('sgm').hidden = true;
  };
  $('sgm').addEventListener('click', function (e) {
    if (e.target === this) this.hidden = true;
  });

  $('pmo-close').onclick = () => {
    $('pmo').hidden = true;
  };
  $('pmo').addEventListener('click', function (e) {
    if (e.target === this) this.hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      openCart(false);
      $('lb').classList.remove('on');
      $('sgm').hidden = true;
      $('pmo').hidden = true;
    }
  });

  // Promo apply (server validated via /api/promo)
  $('pa').onclick = async () => {
    const v = $('pc2').value.trim().toUpperCase();
    $('pc2').value = '';
    if (!v) return;
    const { sub } = getTotals();

    if (location.protocol !== 'file:') {
      try {
        const res = await fetch('/api/promo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: v, subtotal: sub })
        });
        const data = await res.json();
        if (!res.ok) {
          promo = '';
          promoPercent = 0;
          renderCart();
          $('pmsg').textContent = data.error || 'That code is not valid.';
          return;
        }
        promo = data.code;
        promoPercent = data.percent;
        PROMOS[promo] = promoPercent;
        renderCart();
        toast(`${promo} applied`);
        return;
      } catch {
        // Fallback
      }
    }

    if (PROMOS[v]) {
      promo = v;
      promoPercent = PROMOS[v];
      renderCart();
      toast(`${v} applied`);
    } else {
      promo = '';
      promoPercent = 0;
      renderCart();
      $('pmsg').textContent = 'That code is not valid.';
    }
  };

  // Checkout submit -> saves in D1 via POST /api/orders then opens WhatsApp or Paymob
  $('ck').onsubmit = async (e) => {
    e.preventDefault();
    if (!cart.length) return;

    const btn = $('ck').querySelector('button[type="submit"]');
    const name = $('nm').value.trim();
    const phone = $('ph').value.trim();
    const email = ($('em2')?.value || '').trim();
    const governorate = $('ct').value;
    const address = $('ad').value.trim();
    const notes = ($('nt')?.value || '').trim();
    const paymentMethod = document.querySelector('[name="pm"]:checked').value;

    if (location.protocol !== 'file:') {
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Saving order...';
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
            items: cart.map((c) => ({ productId: c.id, size: c.size, color: c.color, qty: c.qty }))
          })
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || 'Could not place order.');
          btn.disabled = false;
          btn.textContent = orig;
          return;
        }
        cart = [];
        renderCart();
        syncFromBackend();

        if (data.paymentUrl) {
          toast(`Order ${data.order.code} saved — redirecting to Paymob...`);
          window.location.href = data.paymentUrl;
          return;
        }
        window.open(`https://wa.me/${data.whatsapp.number}?text=${encodeURIComponent(data.whatsapp.text)}`, '_blank', 'noopener,noreferrer');
        toast(`Order ${data.order.code} saved! Send on WhatsApp to confirm.`);
      } catch {
        toast('Network error — please try again.');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
      return;
    }

    const { ds, sh, total } = getTotals();
    const id = `GG-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const m =
      `New Gym Gang order ${id}\n` +
      cart.map((c) => `- ${productById.get(c.id).name} (${c.size}) x${c.qty} = ${F(productById.get(c.id).price * c.qty)}`).join('\n') +
      (ds ? `\nPromo ${promo}: -${F(ds)}` : '') +
      `\nDelivery: ${sh ? F(sh) : 'Free'}\nTotal: ${F(total)}\nName: ${name}\nPhone: ${phone}\nCity: ${governorate}\nAddress: ${address}\nPayment: ${paymentMethod}\nEstimated delivery: ${eta()}`;
    window.open(`https://wa.me/${BRAND_CONFIG.whatsapp}?text=${encodeURIComponent(m)}`, '_blank');
    toast(`Order ${id} ready. Send it on WhatsApp to confirm.`);
  };

  // Newsletter submit -> saves in D1 via POST /api/newsletter
  $('f').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('em').value.trim();
    if (!email) return;

    if (location.protocol !== 'file:') {
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) {
          $('msg').textContent = data.error || 'Could not subscribe right now.';
          return;
        }
        const code = data.promoCode || 'GANG10';
        window.GG.applyPromo(code);
        $('msg').textContent = data.alreadySubscribed
          ? `You’re already in the gang. Code ${code} is active in your cart.`
          : `You’re in the gang. Code ${code} is applied to your cart: 10% off your first order.`;
        $('em').value = '';
        return;
      } catch {
        // Fallback
      }
    }

    window.GG.applyPromo('GANG10');
    $('msg').textContent = 'You’re in the gang. Code GANG10 is applied to your cart: 10% off your first order.';
    $('em').value = '';
  };

  // Back to top button
  const tBtn = $('to-top-btn');
  tBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.addEventListener('scroll', () => tBtn.classList.toggle('on', window.scrollY > 700), { passive: true });
})();
