(function () {
  const { BRAND_CONFIG } = window.GG;
  const $ = (id) => document.getElementById(id);
  const rm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;
  const B = document.body;
  const nav = document.querySelector('nav');
  const hero = document.querySelector('.hero');

  /* ===== 1. Calm Intro Curtain + Shockwave Finale ===== */
  const ld = $('ld');
  const finishIntro = () => {
    if (B.classList.contains('ok')) return;
    B.classList.add('ok');
    ld.classList.add('out');
    if (!rm) {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;left:50%;top:50%;width:80px;height:80px;margin:-40px;border:2px solid #C8A45C;border-radius:50%;z-index:101;pointer-events:none';
      B.appendChild(r);
      r.animate(
        [
          { transform: 'scale(.2)', opacity: 1 },
          { transform: 'scale(28)', opacity: 0 }
        ],
        { duration: 1200, easing: 'cubic-bezier(.15,.7,.2,1)' }
      ).onfinish = () => r.remove();
      hero.animate(
        [{ translate: '0 0' }, { translate: '0 6px' }, { translate: '0 -4px' }, { translate: '0 2px' }, { translate: '0 0' }],
        { duration: 450, delay: 250, easing: 'ease-out' }
      );
    }
  };
  ld.onclick = finishIntro;
  if (rm) finishIntro();
  else setTimeout(finishIntro, 1800);

  /* ===== 2. Hero Letter Shimmer, Word Reveal & Manifesto Word Slam ===== */
  const h1 = hero.querySelector('h1');
  h1.setAttribute('aria-label', 'Gym Gang');
  h1.innerHTML = h1.textContent
    .split('')
    .map((c, i) => `<i aria-hidden="true" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</i>`)
    .join('');

  document.querySelectorAll('h2.d').forEach((el) => {
    let n = 0;
    el.setAttribute('aria-label', el.textContent);
    el.innerHTML = el.textContent
      .split(' ')
      .map((w) => `<span class="w" aria-hidden="true"><i style="--i:${n++}">${w}</i></span>`)
      .join(' ');
  });

  const mf = $('mfp');
  mf.innerHTML = mf.textContent
    .split(' ')
    .map((w) => `<span>${w}</span>`)
    .join(' ');
  const words = [].slice.call(mf.children);

  /* ===== 3. Ghost Section Watermarks ===== */
  const gh = [];
  if (!rm) {
    [
      ['shop', 'Shop'],
      ['gang', 'Gang'],
      ['lab', 'Lab'],
      ['faq', 'Ask']
    ].forEach((a) => {
      const s = $(a[0]);
      if (!s) return;
      const e = document.createElement('span');
      e.className = 'gh';
      e.setAttribute('aria-hidden', 'true');
      e.textContent = a[1];
      s.appendChild(e);
      gh.push([s, e]);
    });
  }

  /* ===== 4. Scroll Progress, Hero Drift, Manifesto Slam & Barbell Weight Stack ===== */
  const pg = $('pg');
  const bg = document.querySelector('.hero .bg');
  const inn = hero.querySelector('.in');
  const splitIm = document.querySelector('.split img');
  const PL = [25, 20, 15, 10, 5, 2.5, 1.25];
  const CL = { 25: '#c9bba6', 20: '#b3a58f', 15: '#9d9080', 10: '#877b6c', 5: '#6f6559', 2.5: '#575047', 1.25: '#403b35' };
  const WD = { 25: 30, 20: 26, 15: 22, 10: 18, 5: 14, 2.5: 11, 1.25: 9 };
  const ws = $('ws');
  const wk = $('wk');
  const wp = $('wp');
  let lastKg = -1;
  let ly = window.scrollY;

  function onScroll() {
    const d = document.documentElement;
    const y = window.scrollY;
    const dy = y - ly;
    ly = y;
    const maxScroll = Math.max(1, d.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, y / maxScroll));

    pg.style.transform = `scaleX(${ratio})`;

    if (!rm && y < window.innerHeight * 1.2) {
      bg.style.translate = `0 ${y * 0.2}px`;
      inn.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.85)));
      inn.style.translate = `0 ${y * 0.14}px`;
    }

    if (y > 320 && dy > 3 && !$('mm').classList.contains('on') && !$('dr').classList.contains('on')) {
      nav.classList.add('hd');
    } else if (dy < -3 || y < 320) {
      nav.classList.remove('hd');
    }

    const r = mf.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (window.innerHeight * 0.82 - r.top) / (r.height + window.innerHeight * 0.3)));
    words.forEach((w, i) => w.classList.toggle('on', i / words.length < p * 1.15));

    if (splitIm && !rm) {
      const sr = splitIm.getBoundingClientRect();
      const sp = Math.min(1, Math.max(0, (window.innerHeight - sr.top) / (window.innerHeight + sr.height)));
      splitIm.style.objectPosition = `${15 + 70 * sp}% 50%`;
    }

    gh.forEach((g) => {
      const gr = g[0].getBoundingClientRect();
      if (gr.bottom < 0 || gr.top > window.innerHeight) return;
      g[1].style.transform = `translateX(${(gr.top - window.innerHeight * 0.5) * 0.32}px)`;
    });

    const kg = 20 + Math.round((280 * ratio) / 2.5) * 2.5;
    if (kg !== lastKg) {
      lastKg = kg;
      let s = (kg - 20) / 2;
      let h = '';
      PL.forEach((q) => {
        const n = Math.floor(s / q + 1e-9);
        for (let k = 0; k < n; k += 1) h += `<i style="width:${WD[q]}px;background:${CL[q]}"></i>`;
        s -= n * q;
      });
      wp.innerHTML = h;
      wk.textContent = kg >= 300 ? 'PR 300 KG' : `${kg} KG`;
      ws.classList.toggle('pr', kg >= 300);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ===== 5. Active Nav Observer & Mobile Menu ===== */
  const navIO = new IntersectionObserver(
    (es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          document.querySelectorAll('nav .links a, #mm a').forEach((a) => {
            a.classList.toggle('act', a.getAttribute('href') === `#${e.target.id}`);
          });
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  ['shop', 'mf', 'gang', 'lab', 'join', 'contact'].forEach((id) => {
    const el = $(id);
    if (el) navIO.observe(el);
  });

  const mm = $('mm');
  const mb = $('mb');
  function toggleMenu(o) {
    mm.classList.toggle('on', o);
    mb.setAttribute('aria-expanded', String(o));
    mb.textContent = o ? 'Close' : 'Menu';
    B.style.overflow = o ? 'hidden' : '';
  }
  mb.onclick = () => toggleMenu(!mm.classList.contains('on'));
  mm.addEventListener('click', (e) => {
    if (e.target.closest('a')) toggleMenu(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleMenu(false);
  });

  /* ===== 6. Hero Spotlight, Logo Parallax, Floating Gold Dust & Cursor Chalk Trail ===== */
  const lg = hero.querySelector('.lg');
  let idle = true;
  function moveSpotlight(e) {
    idle = false;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
    hero.style.setProperty('--my', `${e.clientY - r.top}px`);
    if (!rm && lg) {
      lg.style.translate = `${((e.clientX - r.left) / r.width - 0.5) * 22}px ${((e.clientY - r.top) / r.height - 0.5) * 16}px`;
    }
  }
  hero.addEventListener('pointermove', moveSpotlight);
  hero.addEventListener('pointerdown', moveSpotlight);

  if (!rm) {
    (function drift(t) {
      const r = hero.getBoundingClientRect();
      if (idle && r.bottom > 0 && r.top < window.innerHeight) {
        hero.style.setProperty('--mx', `${r.width * (0.5 + 0.28 * Math.sin(t / 1800))}px`);
        hero.style.setProperty('--my', `${r.height * (0.42 + 0.18 * Math.cos(t / 2300))}px`);
      }
      requestAnimationFrame(drift);
    })(0);

    // Gold dust floating up the hero
    const dustCv = document.createElement('canvas');
    dustCv.setAttribute('aria-hidden', 'true');
    dustCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    hero.insertBefore(dustCv, inn);
    const dcx = dustCv.getContext('2d');
    let dW = 0;
    let dH = 0;
    const ps = [];
    const szDust = () => {
      dW = dustCv.width = hero.clientWidth;
      dH = dustCv.height = hero.clientHeight;
    };
    const mkDust = (a) => ({
      x: Math.random() * dW,
      y: a ? Math.random() * dH : dH + 10,
      r: Math.random() * 2 + 0.6,
      v: Math.random() * 0.6 + 0.25,
      d: Math.random() * 6.28,
      a: Math.random() * 0.5 + 0.25
    });
    szDust();
    window.addEventListener('resize', szDust);
    for (let i = 0; i < (window.innerWidth < 700 ? 16 : 36); i += 1) ps.push(mkDust(1));
    (function animDust(t) {
      const r = hero.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        if (dW !== hero.clientWidth || dH !== hero.clientHeight) szDust();
        dcx.clearRect(0, 0, dW, dH);
        ps.forEach((p, i) => {
          p.y -= p.v;
          p.x += Math.sin(t / 900 + p.d) * 0.4;
          if (p.y < -10) ps[i] = mkDust(0);
          dcx.globalAlpha = p.a * Math.max(0, Math.min(1, (dH - p.y) / 120));
          dcx.fillStyle = '#C8A45C';
          dcx.beginPath();
          dcx.arc(p.x, p.y, p.r, 0, 6.283);
          dcx.fill();
        });
      }
      requestAnimationFrame(animDust);
    })(0);
  }

  /* ===== 7. Rotating Barbell Plate Cursor, 3D Card Tilt & Magnetic Buttons ===== */
  if (fine && !rm) {
    const cu = $('cu');
    const b = document.createElement('b');
    let kg = 20;
    let rot = 0;
    let lx = 0;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    cu.appendChild(b);
    b.textContent = `${kg}kg`;

    window.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cu.classList.add('v');
      if (lx) rot += (e.clientX - lx) * 0.5;
      lx = e.clientX;
      cu.style.setProperty('--r', `${rot}deg`);

      const m = e.target.closest('.btn, .cart');
      if (m) {
        const r = m.getBoundingClientRect();
        m.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.22}px ${(e.clientY - r.top - r.height / 2) * 0.3}px`;
      }
      const c = e.target.closest('.card');
      if (c) {
        const q = c.getBoundingClientRect();
        c.style.setProperty('--gx', `${e.clientX - q.left}px`);
        c.style.setProperty('--gy', `${e.clientY - q.top}px`);
        c.style.transform = `perspective(800px) rotateY(${((e.clientX - q.left) / q.width - 0.5) * 7}deg) rotateX(${(0.5 - (e.clientY - q.top) / q.height) * 7}deg) translateY(-6px)`;
      }
    });

    (function loopCursor() {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      cu.style.transform = `translate(${x}px,${y}px)`;
      requestAnimationFrame(loopCursor);
    })();

    document.addEventListener('pointerover', (e) => {
      cu.classList.toggle('h', !!e.target.closest('a, button, [data-z], input, select, summary, label'));
    });

    document.addEventListener('pointerout', (e) => {
      const m = e.target.closest('.btn, .cart');
      if (m && !m.contains(e.relatedTarget)) m.style.translate = '';
      const c = e.target.closest('.card');
      if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    });

    window.addEventListener('click', (e) => {
      kg += 2.5;
      const f = document.createElement('span');
      f.className = 'fl';
      f.textContent = '+2.5';
      f.style.left = `${e.clientX}px`;
      f.style.top = `${e.clientY - 20}px`;
      B.appendChild(f);
      setTimeout(() => f.remove(), 900);
      window.GG.clank(300 + kg * 2);
      if (kg >= 100) {
        kg = 20;
        cu.classList.add('pr');
        window.GG.toast('PR! 100 kg on the bar');
        window.GG.clank(700);
        setTimeout(() => cu.classList.remove('pr'), 900);
      }
      b.textContent = `${kg}kg`;
    });
  }

  /* ===== 8. Hold & Release Chalk Clap Canvas ===== */
  if (!rm) {
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:85';
    B.appendChild(c);
    const x = c.getContext('2d');
    let W = 0;
    let H = 0;
    const D = Math.min(window.devicePixelRatio || 1, 2);
    const P = [];
    let run = 0;
    const rs = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      c.width = W * D;
      c.height = H * D;
      x.setTransform(D, 0, 0, D, 0, 0);
    };
    rs();
    window.addEventListener('resize', rs);

    function stepChalk() {
      x.clearRect(0, 0, W, H);
      for (let i = P.length - 1; i >= 0; i -= 1) {
        const p = P[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.big) {
          p.vx *= 0.965;
          p.vy = p.vy * 0.965 - 0.004;
        } else {
          p.vx *= 0.94;
          p.vy = p.vy * 0.94 + 0.08;
        }
        p.l -= 1;
        if (p.l <= 0) {
          P.splice(i, 1);
          continue;
        }
        const k = p.l / p.m;
        if (p.big) {
          const r = p.r * (1.6 - k * 0.6);
          const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(237,235,231,${0.16 * k})`);
          g.addColorStop(1, 'rgba(237,235,231,0)');
          x.fillStyle = g;
          x.beginPath();
          x.arc(p.x, p.y, r, 0, 6.283);
          x.fill();
        } else {
          x.fillStyle = `rgba(237,235,231,${0.85 * k})`;
          x.beginPath();
          x.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, 6.283);
          x.fill();
        }
      }
      if (P.length) requestAnimationFrame(stepChalk);
      else run = 0;
    }

    function puff(px, py, pw) {
      const n = Math.round(35 + pw * 80);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * 6.283;
        const s = Math.sqrt(Math.random()) * (4 + pw * 9);
        const l = 65 + Math.random() * 55;
        P.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, r: 1 + Math.random() * 3, l, m: l });
      }
      for (let i = 0; i < 7 + pw * 7; i += 1) {
        const a = Math.random() * 6.283;
        const s = Math.random() * (2 + pw * 3.5);
        const l = 85 + Math.random() * 45;
        P.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, r: 22 + Math.random() * 28 + pw * 22, l, m: l, big: 1 });
      }
      if (!run) {
        run = 1;
        requestAnimationFrame(stepChalk);
      }
    }

    const ring = document.createElement('i');
    ring.style.cssText = 'position:fixed;left:0;top:0;width:96px;height:96px;margin:-48px 0 0 -48px;border:2px solid #C8A45C;border-radius:50%;pointer-events:none;z-index:86;opacity:0;transform:scale(.2)';
    B.appendChild(ring);
    let t0 = 0;
    let hold = 0;
    const canClap = (e) =>
      e.target.closest && !e.target.closest('a, button, input, select, textarea, summary, label, [data-z], .dr, .lb, .mm, .ov, .sgm, #ld');

    window.addEventListener('pointerdown', (e) => {
      if (!canClap(e)) return;
      hold = 1;
      t0 = performance.now();
      ring.style.transition = 'none';
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      ring.style.opacity = '.9';
      ring.style.transform = 'scale(.2)';
      void ring.offsetWidth;
      ring.style.transition = 'transform .9s linear';
      ring.style.transform = 'scale(1)';
    });
    const endHold = () => {
      hold = 0;
      ring.style.transition = 'opacity .2s';
      ring.style.opacity = '0';
    };
    window.addEventListener('pointerup', (e) => {
      if (!hold) return;
      const d = Math.min(1, (performance.now() - t0) / 900);
      endHold();
      puff(e.clientX, e.clientY, d);
    });
    window.addEventListener('pointercancel', endHold);
  }

  /* ===== 9. Gear Lab: Dynamic Size Finder & Olympic Plate Loader ===== */
  const H = { 25: 92, 20: 84, 15: 74, 10: 62, 5: 50, 2.5: 40, 1.25: 32 };
  function pl() {
    const w = Number($('pw').value);
    let s = (w - 20) / 2;
    const a = [];
    $('pwv').textContent = String(w);
    PL.forEach((p) => {
      const n = Math.floor(s / p + 1e-9);
      for (let k = 0; k < n; k += 1) a.push(p);
      s -= n * p;
    });
    const g = {};
    a.forEach((p) => {
      g[p] = (g[p] || 0) + 1;
    });
    const el = (p, i) => `<i style="height:${H[p]}px;background:${CL[p]};width:${p >= 10 ? 16 : 10}px;animation-delay:${i * 40}ms"></i>`;
    $('pbar').innerHTML = `<div class="sd">${a.slice().reverse().map(el).join('')}</div><span class="br"></span><div class="sd">${a.map(el).join('')}</div>`;
    $('pr').textContent = a.length
      ? `Each side: ${Object.keys(g)
          .sort((m, n) => n - m)
          .map((p) => `${g[p]} × ${p} kg`)
          .join(' + ')}. Total ${w} kg with a 20 kg bar.`
      : 'Just the empty 20 kg bar.';
  }
  $('pw').oninput = pl;
  document.querySelectorAll('.chips button').forEach((b) => {
    b.onclick = () => {
      $('pw').value = b.dataset.w;
      pl();
    };
  });
  pl();

  $('sf').onsubmit = (e) => {
    e.preventDefault();
    const h = Number($('ht').value);
    const w = Number($('wt').value);
    const r = $('sr');
    if (h < 140 || h > 220 || w < 35 || w > 200) {
      r.textContent = 'Enter a height between 140 and 220 cm and a weight between 35 and 200 kg.';
      return;
    }
    const guide =
      BRAND_CONFIG.sizeGuide && BRAND_CONFIG.sizeGuide.length
        ? BRAND_CONFIG.sizeGuide
        : [
            { size: 'S', below: 65 },
            { size: 'M', below: 78 },
            { size: 'L', below: 92 },
            { size: 'XL', below: null }
          ];
    const S = guide.map((g) => g.size);
    let i = guide.findIndex((g) => g.below === null || w < g.below);
    if (i < 0) i = S.length - 1;
    if (h >= (BRAND_CONFIG.tallCm || 186) && i < S.length - 1) i += 1;
    if (h <= (BRAND_CONFIG.shortCm || 165) && i > 0) i -= 1;

    const hd = $('hf').value === 'o' ? Math.max(i - 1, 0) : i;
    r.innerHTML = `Compression tee: <b>${S[i]}</b> &middot; Hoodie: <b>${S[hd]}</b><button type="button" class="lnk" id="us" style="display:block;margin-top:8px">Use these sizes</button><small>An estimate for typical builds. Between sizes? Size up.</small>`;
    $('us').onclick = () => {
      window.GG.applyRecommendedSizes(S[i], S[hd]);
      location.hash = 'shop';
    };
  };
})();
