(function () {
  const { BRAND_CONFIG } = window.GG;
  const byId = (id) => document.getElementById(id);
  const formatCurrency = (amount) => `${Number(amount || 0).toLocaleString('en-US')} EGP`;

  let soundEnabled = false;
  let audioContext = null;

  function playBarbellClank(baseFrequency) {
    if (!soundEnabled) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      [baseFrequency, baseFrequency * 2.7, baseFrequency * 4.1].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = index ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.16 / (index + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
      });
    } catch {
      // WebAudio blocked by browser policy
    }
  }

  function toggleSound(button) {
    soundEnabled = !soundEnabled;
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.textContent = soundEnabled ? 'Sound on' : 'Sound off';
    playBarbellClank(520);
  }

  function showToast(message) {
    const toastEl = byId('toast');
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('on');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('on'), 2100);
  }

  const StorageRepository = {
    loadCart() {
      try {
        const raw = JSON.parse(localStorage.getItem(BRAND_CONFIG.storageKey) || '[]');
        return Array.isArray(raw)
          ? raw
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
    },
    loadWishlist() {
      try {
        const raw = JSON.parse(localStorage.getItem(BRAND_CONFIG.wishKey) || '[]');
        return Array.isArray(raw) ? raw.map(Number) : [];
      } catch {
        return [];
      }
    },
    loadPromoCode() {
      try {
        return (localStorage.getItem(BRAND_CONFIG.promoKey) || '').toUpperCase();
      } catch {
        return '';
      }
    },
    saveAll(cart, wishlist, promoCode) {
      try {
        localStorage.setItem(BRAND_CONFIG.storageKey, JSON.stringify(cart));
        localStorage.setItem(BRAND_CONFIG.wishKey, JSON.stringify(wishlist));
        localStorage.setItem(BRAND_CONFIG.promoKey, promoCode);
      } catch {
        // Storage unavailable
      }
    }
  };

  const StoreApiClient = {
    isOnlineMode() {
      return location.protocol !== 'file:';
    },
    async fetchConfigAndProducts() {
      const bust = Date.now();
      const [cfgRes, prodRes] = await Promise.all([
        fetch(`/api/config?_=${bust}`, { cache: 'no-store' }),
        fetch(`/api/products?_=${bust}`, { cache: 'no-store' })
      ]);
      const config = cfgRes.ok ? await cfgRes.json() : null;
      const productsData = prodRes.ok ? await prodRes.json() : null;
      if (config?.version) checkVersionAndReloadIfStale(config.version);
      return { config, products: productsData?.products || null };
    },
    async validatePromo(code, subtotal) {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That code is not valid.');
      return data;
    },
    async createOrder(orderPayload) {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place order.');
      return data;
    },
    async subscribeNewsletter(email) {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not subscribe right now.');
      return data;
    }
  };

  function checkVersionAndReloadIfStale(serverVersion) {
    const meta = document.querySelector('meta[name="app-version"]');
    const localVersion = meta ? meta.getAttribute('content') : '';
    if (!localVersion || !serverVersion || localVersion === serverVersion) return;
    if (sessionStorage.getItem('gg_reloaded_ver') === serverVersion) return;
    sessionStorage.setItem('gg_reloaded_ver', serverVersion);
    const url = new URL(location.href);
    url.searchParams.set('v', serverVersion);
    location.replace(url.toString());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && StoreApiClient.isOnlineMode()) {
      window.GG.hydrateStoreFromApi?.();
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && StoreApiClient.isOnlineMode()) {
      window.GG.hydrateStoreFromApi?.();
    }
  });

  window.GG.byId = byId;
  window.GG.formatCurrency = formatCurrency;
  window.GG.clank = playBarbellClank;
  window.GG.toggleSound = toggleSound;
  window.GG.toast = showToast;
  window.GG.StorageRepository = StorageRepository;
  window.GG.StoreApiClient = StoreApiClient;
})();
