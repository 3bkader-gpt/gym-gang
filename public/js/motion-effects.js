(function () {
  const { byId } = window.GG;
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const body = document.body;
  const nav = document.querySelector('nav');
  const hero = document.querySelector('.hero');

  // 1. Marquee tickers
  byId('tk').innerHTML = Array(15).join('<span>BUILT TOGETHER &nbsp;&#10022;&nbsp; STRENGTH IN UNITY &nbsp;&#10022;&nbsp; BUILT DIFFERENT &nbsp;&#10022;&nbsp; </span>');
  byId('tk2').innerHTML = Array(15).join('<span>DISCIPLINE &nbsp;&#10022;&nbsp; CONSISTENCY &nbsp;&#10022;&nbsp; COMMUNITY &nbsp;&#10022;&nbsp; </span>');

  // 2. Calm Intro Curtain + Shockwave Ring Finale
  const loader = byId('ld');
  function dismissIntro() {
    if (body.classList.contains('ok')) return;
    body.classList.add('ok');
    loader.classList.add('out');
    if (!reducedMotion) {
      const ring = document.createElement('div');
      ring.style.cssText = 'position:fixed;left:50%;top:50%;width:80px;height:80px;margin:-40px;border:2px solid #C8A45C;border-radius:50%;z-index:101;pointer-events:none';
      body.appendChild(ring);
      ring.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(28)', opacity: 0 }], {
        duration: 1200,
        easing: 'cubic-bezier(.15,.7,.2,1)'
      }).onfinish = () => ring.remove();
      hero.animate(
        [{ translate: '0 0' }, { translate: '0 6px' }, { translate: '0 -4px' }, { translate: '0 2px' }, { translate: '0 0' }],
        { duration: 450, delay: 250, easing: 'ease-out' }
      );
    }
  }
  loader.onclick = dismissIntro;
  if (reducedMotion) dismissIntro();
  else setTimeout(dismissIntro, 1800);

  // 3. Hero Letter Shimmer, Section Word Split & Manifesto Word Slam
  const h1 = hero.querySelector('h1');
  h1.setAttribute('aria-label', 'Gym Gang');
  h1.innerHTML = h1.textContent
    .split('')
    .map((char, idx) => `<i aria-hidden="true" style="--i:${idx}">${char === ' ' ? '&nbsp;' : char}</i>`)
    .join('');

  document.querySelectorAll('h2.d').forEach((heading) => {
    let idx = 0;
    heading.setAttribute('aria-label', heading.textContent);
    heading.innerHTML = heading.textContent
      .split(' ')
      .map((word) => `<span class="w" aria-hidden="true"><i style="--i:${idx++}">${word}</i></span>`)
      .join(' ');
  });

  const manifesto = byId('mfp');
  manifesto.innerHTML = manifesto.textContent
    .split(' ')
    .map((word) => `<span>${word}</span>`)
    .join(' ');
  const manifestoWords = Array.from(manifesto.children);

  // 4. Ghost Section Watermarks
  const ghostHeaders = [];
  if (!reducedMotion) {
    [['shop', 'Shop'], ['gang', 'Gang'], ['lab', 'Lab'], ['faq', 'Ask']].forEach(([secId, label]) => {
      const sec = byId(secId);
      if (!sec) return;
      const span = document.createElement('span');
      span.className = 'gh';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = label;
      sec.appendChild(span);
      ghostHeaders.push([sec, span]);
    });
  }

  // 5. Scroll Progress, Barbell Weight Stack & Reveal Observers
  const progressBar = byId('pg');
  const heroBg = document.querySelector('.hero .bg');
  const heroInner = hero.querySelector('.in');
  const splitImage = document.querySelector('.split img');
  const toTopBtn = byId('to-top-btn');
  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  const COLORS = { 25: '#c9bba6', 20: '#b3a58f', 15: '#9d9080', 10: '#877b6c', 5: '#6f6559', 2.5: '#575047', 1.25: '#403b35' };
  const WIDTHS = { 25: 30, 20: 26, 15: 22, 10: 18, 5: 14, 2.5: 11, 1.25: 9 };
  const stackBox = byId('ws');
  const stackLabel = byId('wk');
  const stackPlates = byId('wp');
  let lastStackKg = -1;
  let lastScrollY = window.scrollY;

  function handleScroll() {
    const doc = document.documentElement;
    const y = window.scrollY;
    const dy = y - lastScrollY;
    lastScrollY = y;
    const ratio = Math.min(1, Math.max(0, y / Math.max(1, doc.scrollHeight - window.innerHeight)));

    progressBar.style.transform = `scaleX(${ratio})`;
    toTopBtn.classList.toggle('on', y > 700);

    if (!reducedMotion && y < window.innerHeight * 1.2) {
      heroBg.style.translate = `0 ${y * 0.2}px`;
      heroInner.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.85)));
      heroInner.style.translate = `0 ${y * 0.14}px`;
    }

    if (y > 320 && dy > 3 && !byId('mm').classList.contains('on') && !byId('dr').classList.contains('on')) {
      nav.classList.add('hd');
    } else if (dy < -3 || y < 320) {
      nav.classList.remove('hd');
    }

    const mfRect = manifesto.getBoundingClientRect();
    const mfProgress = Math.min(1, Math.max(0, (window.innerHeight * 0.82 - mfRect.top) / (mfRect.height + window.innerHeight * 0.3)));
    manifestoWords.forEach((w, i) => w.classList.toggle('on', i / manifestoWords.length < mfProgress * 1.15));

    if (splitImage && !reducedMotion) {
      const sr = splitImage.getBoundingClientRect();
      const sp = Math.min(1, Math.max(0, (window.innerHeight - sr.top) / (window.innerHeight + sr.height)));
      splitImage.style.objectPosition = `${15 + 70 * sp}% 50%`;
    }

    ghostHeaders.forEach(([sec, span]) => {
      const r = sec.getBoundingClientRect();
      if (r.bottom >= 0 && r.top <= window.innerHeight) {
        span.style.transform = `translateX(${(r.top - window.innerHeight * 0.5) * 0.32}px)`;
      }
    });

    const kg = 20 + Math.round((280 * ratio) / 2.5) * 2.5;
    if (kg !== lastStackKg) {
      lastStackKg = kg;
      let perSide = (kg - 20) / 2;
      let html = '';
      PLATES.forEach((p) => {
        const count = Math.floor(perSide / p + 1e-9);
        for (let k = 0; k < count; k += 1) html += `<i style="width:${WIDTHS[p]}px;background:${COLORS[p]}"></i>`;
        perSide -= count * p;
      });
      stackPlates.innerHTML = html;
      stackLabel.textContent = kg >= 300 ? 'PR 300 KG' : `${kg} KG`;
      stackBox.classList.toggle('pr', kg >= 300);
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll('.rv').forEach((el) => revealObserver.observe(el));

  const trustStrip = document.querySelector('.tr2');
  if (trustStrip) {
    trustStrip.querySelectorAll('svg *').forEach((n) => n.setAttribute('pathLength', 1));
    new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            trustStrip.classList.add('go');
            obs.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    ).observe(trustStrip);
  }

  // 6. Active Nav Highlight & Mobile Menu
  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          document.querySelectorAll('nav .links a, #mm a').forEach((link) => {
            link.classList.toggle('act', link.getAttribute('href') === `#${entry.target.id}`);
          });
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  ['shop', 'mf', 'gang', 'lab', 'join', 'contact'].forEach((id) => {
    const el = byId(id);
    if (el) navObserver.observe(el);
  });

  const mobileMenu = byId('mm');
  const menuBtn = byId('mb');
  function setMobileMenuOpen(isOpen) {
    mobileMenu.classList.toggle('on', isOpen);
    menuBtn.setAttribute('aria-expanded', String(isOpen));
    menuBtn.textContent = isOpen ? 'Close' : 'Menu';
    body.style.overflow = isOpen ? 'hidden' : '';
  }
  menuBtn.onclick = () => setMobileMenuOpen(!mobileMenu.classList.contains('on'));
  mobileMenu.addEventListener('click', (e) => { if (e.target.closest('a')) setMobileMenuOpen(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMobileMenuOpen(false); });
})();
