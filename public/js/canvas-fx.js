(function () {
  const { byId, clank, toast } = window.GG;
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const body = document.body;
  const hero = document.querySelector('.hero');
  const heroInner = hero.querySelector('.in');
  const heroLogo = hero.querySelector('.lg');

  // 1. Hero Cursor Spotlight & Logo Parallax
  let spotlightIdle = true;
  function updateHeroSpotlight(e) {
    spotlightIdle = false;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    hero.style.setProperty('--my', `${e.clientY - rect.top}px`);
    if (!reducedMotion && heroLogo) {
      heroLogo.style.translate = `${((e.clientX - rect.left) / rect.width - 0.5) * 22}px ${((e.clientY - rect.top) / rect.height - 0.5) * 16}px`;
    }
  }
  hero.addEventListener('pointermove', updateHeroSpotlight);
  hero.addEventListener('pointerdown', updateHeroSpotlight);

  if (reducedMotion) return;

  (function driftSpotlight(time) {
    const rect = hero.getBoundingClientRect();
    if (spotlightIdle && rect.bottom > 0 && rect.top < window.innerHeight) {
      hero.style.setProperty('--mx', `${rect.width * (0.5 + 0.28 * Math.sin(time / 1800))}px`);
      hero.style.setProperty('--my', `${rect.height * (0.42 + 0.18 * Math.cos(time / 2300))}px`);
    }
    requestAnimationFrame(driftSpotlight);
  })(0);

  // 2. Floating Gold Dust Canvas in Hero
  const dustCanvas = document.createElement('canvas');
  dustCanvas.setAttribute('aria-hidden', 'true');
  dustCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  hero.insertBefore(dustCanvas, heroInner);
  const dustCtx = dustCanvas.getContext('2d');
  let dustW = 0;
  let dustH = 0;
  const dustParticles = [];

  function resizeDustCanvas() {
    dustW = dustCanvas.width = hero.clientWidth;
    dustH = dustCanvas.height = hero.clientHeight;
  }
  function createDustParticle(randomY) {
    return {
      x: Math.random() * dustW,
      y: randomY ? Math.random() * dustH : dustH + 10,
      r: Math.random() * 2 + 0.6,
      v: Math.random() * 0.6 + 0.25,
      d: Math.random() * 6.28,
      a: Math.random() * 0.5 + 0.25
    };
  }
  resizeDustCanvas();
  window.addEventListener('resize', resizeDustCanvas);
  for (let i = 0; i < (window.innerWidth < 700 ? 16 : 36); i += 1) dustParticles.push(createDustParticle(true));

  (function animateDust(time) {
    const rect = hero.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      if (dustW !== hero.clientWidth || dustH !== hero.clientHeight) resizeDustCanvas();
      dustCtx.clearRect(0, 0, dustW, dustH);
      dustParticles.forEach((p, idx) => {
        p.y -= p.v;
        p.x += Math.sin(time / 900 + p.d) * 0.4;
        if (p.y < -10) dustParticles[idx] = createDustParticle(false);
        dustCtx.globalAlpha = p.a * Math.max(0, Math.min(1, (dustH - p.y) / 120));
        dustCtx.fillStyle = '#C8A45C';
        dustCtx.beginPath();
        dustCtx.arc(p.x, p.y, p.r, 0, 6.283);
        dustCtx.fill();
      });
    }
    requestAnimationFrame(animateDust);
  })(0);

  // 3. Rotating Barbell Plate Cursor, 3D Card Tilt & Magnetic Buttons
  if (finePointer) {
    const cursorEl = byId('cu');
    const weightBadge = document.createElement('b');
    let barWeightKg = 20;
    let rotationDeg = 0;
    let lastClientX = 0;
    let curX = 0;
    let curY = 0;
    let targetX = 0;
    let targetY = 0;
    cursorEl.appendChild(weightBadge);
    weightBadge.textContent = `${barWeightKg}kg`;

    window.addEventListener('pointermove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      cursorEl.classList.add('v');
      if (lastClientX) rotationDeg += (e.clientX - lastClientX) * 0.5;
      lastClientX = e.clientX;
      cursorEl.style.setProperty('--r', `${rotationDeg}deg`);

      const magneticBtn = e.target.closest('.btn, .cart');
      if (magneticBtn) {
        const r = magneticBtn.getBoundingClientRect();
        magneticBtn.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.22}px ${(e.clientY - r.top - r.height / 2) * 0.3}px`;
      }
      const card = e.target.closest('.card');
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--gx', `${e.clientX - r.left}px`);
        card.style.setProperty('--gy', `${e.clientY - r.top}px`);
        card.style.transform = `perspective(800px) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 7}deg) rotateX(${(0.5 - (e.clientY - r.top) / r.height) * 7}deg) translateY(-6px)`;
      }
    });

    (function followCursor() {
      curX += (targetX - curX) * 0.22;
      curY += (targetY - curY) * 0.22;
      cursorEl.style.transform = `translate(${curX}px,${curY}px)`;
      requestAnimationFrame(followCursor);
    })();

    document.addEventListener('pointerover', (e) => {
      cursorEl.classList.toggle('h', !!e.target.closest('a, button, [data-z], input, select, summary, label'));
    });

    document.addEventListener('pointerout', (e) => {
      const magneticBtn = e.target.closest('.btn, .cart');
      if (magneticBtn && !magneticBtn.contains(e.relatedTarget)) magneticBtn.style.translate = '';
      const card = e.target.closest('.card');
      if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });

    window.addEventListener('click', (e) => {
      barWeightKg += 2.5;
      const floater = document.createElement('span');
      floater.className = 'fl';
      floater.textContent = '+2.5';
      floater.style.left = `${e.clientX}px`;
      floater.style.top = `${e.clientY - 20}px`;
      body.appendChild(floater);
      setTimeout(() => floater.remove(), 900);
      clank(300 + barWeightKg * 2);
      if (barWeightKg >= 100) {
        barWeightKg = 20;
        cursorEl.classList.add('pr');
        toast('PR! 100 kg on the bar');
        clank(700);
        setTimeout(() => cursorEl.classList.remove('pr'), 900);
      }
      weightBadge.textContent = `${barWeightKg}kg`;
    });
  }

  // 4. Hold & Release Chalk Clap Particle Engine
  const chalkCanvas = document.createElement('canvas');
  chalkCanvas.setAttribute('aria-hidden', 'true');
  chalkCanvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:85';
  body.appendChild(chalkCanvas);
  const chalkCtx = chalkCanvas.getContext('2d');
  let viewW = 0;
  let viewH = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const chalkPuffs = [];
  let chalkLoopRunning = false;

  function resizeChalkCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    chalkCanvas.width = viewW * dpr;
    chalkCanvas.height = viewH * dpr;
    chalkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeChalkCanvas();
  window.addEventListener('resize', resizeChalkCanvas);

  function stepChalkParticles() {
    chalkCtx.clearRect(0, 0, viewW, viewH);
    for (let i = chalkPuffs.length - 1; i >= 0; i -= 1) {
      const p = chalkPuffs[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.big ? 0.965 : 0.94;
      p.vy = p.big ? p.vy * 0.965 - 0.004 : p.vy * 0.94 + 0.08;
      p.l -= 1;
      if (p.l <= 0) { chalkPuffs.splice(i, 1); continue; }
      const lifeRatio = p.l / p.m;
      if (p.big) {
        const radius = p.r * (1.6 - lifeRatio * 0.6);
        const grad = chalkCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(237,235,231,${0.16 * lifeRatio})`);
        grad.addColorStop(1, 'rgba(237,235,231,0)');
        chalkCtx.fillStyle = grad;
        chalkCtx.beginPath();
        chalkCtx.arc(p.x, p.y, radius, 0, 6.283);
        chalkCtx.fill();
      } else {
        chalkCtx.fillStyle = `rgba(237,235,231,${0.85 * lifeRatio})`;
        chalkCtx.beginPath();
        chalkCtx.arc(p.x, p.y, p.r * (0.5 + lifeRatio * 0.5), 0, 6.283);
        chalkCtx.fill();
      }
    }
    if (chalkPuffs.length) requestAnimationFrame(stepChalkParticles);
    else chalkLoopRunning = false;
  }

  function spawnChalkBurst(px, py, power) {
    const count = Math.round(35 + power * 80);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * 6.283;
      const speed = Math.sqrt(Math.random()) * (4 + power * 9);
      const life = 65 + Math.random() * 55;
      chalkPuffs.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.2, r: 1 + Math.random() * 3, l: life, m: life });
    }
    for (let i = 0; i < 7 + power * 7; i += 1) {
      const angle = Math.random() * 6.283;
      const speed = Math.random() * (2 + power * 3.5);
      const life = 85 + Math.random() * 45;
      chalkPuffs.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.6, r: 22 + Math.random() * 28 + power * 22, l: life, m: life, big: 1 });
    }
    if (!chalkLoopRunning) { chalkLoopRunning = true; requestAnimationFrame(stepChalkParticles); }
  }

  const chargeRing = document.createElement('i');
  chargeRing.style.cssText = 'position:fixed;left:0;top:0;width:96px;height:96px;margin:-48px 0 0 -48px;border:2px solid #C8A45C;border-radius:50%;pointer-events:none;z-index:86;opacity:0;transform:scale(.2)';
  body.appendChild(chargeRing);
  let holdStart = 0;
  let isHolding = false;

  window.addEventListener('pointerdown', (e) => {
    if (!e.target.closest || e.target.closest('a, button, input, select, textarea, summary, label, [data-z], .dr, .lb, .mm, .ov, .sgm, #ld')) return;
    isHolding = true;
    holdStart = performance.now();
    chargeRing.style.transition = 'none';
    chargeRing.style.left = `${e.clientX}px`;
    chargeRing.style.top = `${e.clientY}px`;
    chargeRing.style.opacity = '0.9';
    chargeRing.style.transform = 'scale(0.2)';
    void chargeRing.offsetWidth;
    chargeRing.style.transition = 'transform 0.9s linear';
    chargeRing.style.transform = 'scale(1)';
  });

  function cancelHold() {
    isHolding = false;
    chargeRing.style.transition = 'opacity 0.2s';
    chargeRing.style.opacity = '0';
  }
  window.addEventListener('pointerup', (e) => {
    if (!isHolding) return;
    const power = Math.min(1, (performance.now() - holdStart) / 900);
    cancelHold();
    spawnChalkBurst(e.clientX, e.clientY, power);
  });
  window.addEventListener('pointercancel', cancelHold);
})();
