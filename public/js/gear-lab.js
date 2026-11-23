(function () {
  const { BRAND_CONFIG } = window.GG;

  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  const PLATE_COLORS = {
    25: '#c84b31',
    20: '#b8a995',
    15: '#9c8f7e',
    10: '#827768',
    5: '#685f54',
    2.5: '#4f4840',
    1.25: '#39342e'
  };
  const PLATE_HEIGHTS = {
    25: 88,
    20: 80,
    15: 70,
    10: 58,
    5: 46,
    2.5: 36,
    1.25: 28
  };

  const sizeForm = document.getElementById('size-finder-form');
  const sizeResult = document.getElementById('size-result');

  sizeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const height = Number(document.getElementById('sf-height').value);
    const weight = Number(document.getElementById('sf-weight').value);
    const hoodieFit = document.getElementById('sf-fit').value;

    if (height < 140 || height > 220 || weight < 35 || weight > 200) {
      sizeResult.textContent = 'Enter height between 140–220 cm and weight between 35–200 kg.';
      return;
    }

    const guide = BRAND_CONFIG.sizeGuide && BRAND_CONFIG.sizeGuide.length
      ? BRAND_CONFIG.sizeGuide
      : [
          { size: 'S', below: 65 },
          { size: 'M', below: 78 },
          { size: 'L', below: 92 },
          { size: 'XL', below: null }
        ];
    const sizes = guide.map((g) => g.size);
    let idx = guide.findIndex((g) => g.below === null || weight < g.below);
    if (idx < 0) idx = sizes.length - 1;

    const tallCm = BRAND_CONFIG.tallCm || 186;
    const shortCm = BRAND_CONFIG.shortCm || 165;
    if (height >= tallCm && idx < sizes.length - 1) idx += 1;
    if (height <= shortCm && idx > 0) idx -= 1;

    const teeSize = sizes[idx];
    const hoodieSize = hoodieFit === 'oversized' ? sizes[Math.max(idx - 1, 0)] : teeSize;
    const note = `Estimate for ${height} cm / ${weight} kg. Between sizes? Size up for comfort.`;

    sizeResult.innerHTML = `
      <div>Compression Tee <strong>${teeSize}</strong> Hoodie <strong>${hoodieSize}</strong></div>
      <small>${note}</small>
      <button type="button" class="apply-size-btn" id="apply-fit-btn">Apply sizes in shop</button>
    `;

    document.getElementById('apply-fit-btn').addEventListener('click', () => {
      window.GG.applyRecommendedSizes(teeSize, hoodieSize);
      document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });
  });

  const range = document.getElementById('plate-range');
  const readout = document.getElementById('plate-weight-val');
  const barStage = document.getElementById('bar-stage');
  const breakdown = document.getElementById('plate-breakdown');
  const presetBtns = Array.from(document.querySelectorAll('.weight-chips button'));

  function renderPlateLoader() {
    const totalWeight = Number(range.value);
    readout.textContent = String(totalWeight);

    let perSide = (totalWeight - 20) / 2;
    const loaded = [];

    PLATES.forEach((plate) => {
      const count = Math.floor(perSide / plate + 1e-9);
      for (let i = 0; i < count; i += 1) loaded.push(plate);
      perSide -= count * plate;
    });

    const grouped = new Map();
    loaded.forEach((p) => grouped.set(p, (grouped.get(p) || 0) + 1));

    const plateHtml = (plate) =>
      `<i title="${plate} kg" style="height:${PLATE_HEIGHTS[plate]}px;width:${plate >= 10 ? 15 : 10}px;background:${PLATE_COLORS[plate]}"></i>`;

    barStage.innerHTML = `
      <div class="bar-side">${[...loaded].reverse().map(plateHtml).join('')}</div>
      <span class="bar-shaft"></span>
      <div class="bar-side">${loaded.map(plateHtml).join('')}</div>
    `;

    if (!loaded.length) {
      breakdown.textContent = 'Empty 20 kg Olympic barbell.';
      return;
    }

    const summary = Array.from(grouped.entries())
      .map(([plate, count]) => `${count} × ${plate} kg`)
      .join(' + ');
    breakdown.textContent = `Per side: ${summary} (+ 20 kg bar = ${totalWeight} kg total)`;
  }

  range.addEventListener('input', renderPlateLoader);
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      range.value = btn.dataset.weight;
      renderPlateLoader();
    });
  });
  renderPlateLoader();

  const joinForm = document.getElementById('join-form');
  const joinMsg = document.getElementById('join-msg');
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('join-email').value.trim();
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
          joinMsg.textContent = data.error || 'Could not subscribe right now.';
          return;
        }
        const code = data.promoCode || 'GANG10';
        window.GG.applyPromo(code);
        joinMsg.textContent = data.alreadySubscribed
          ? `You’re already on the Drop 02 list. Code ${code} is active in your bag.`
          : `You’re in the gang! Your email is saved and code ${code} (10% off) is applied to your bag.`;
        joinForm.reset();
        return;
      } catch {
        // Fallback below
      }
    }

    window.GG.applyPromo('GANG10');
    joinMsg.textContent = 'You’re in the gang. Code GANG10 is applied to your bag: 10% off your first order.';
    joinForm.reset();
  });

  const menuBtn = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  menuBtn.addEventListener('click', () => {
    const open = !mobileNav.classList.contains('is-open');
    mobileNav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.textContent = 'Menu';
    });
  });

  const sections = ['shop', 'crew', 'lab', 'faq', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navLinks = Array.from(document.querySelectorAll('.nav-links a'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );
  sections.forEach((sec) => observer.observe(sec));
})();
