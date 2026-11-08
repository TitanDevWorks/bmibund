// Version 5: Schnellsuche (Strg+K), Lichtpunkt auf Karten, Lesefortschritt, Countdown für Veröffentlichungen, Inhaltsverzeichnis.
(() => {
  const B = window.BMIH;
  if (!B) return;
  const { esc, load, t, P, fmtDate } = B;
  const en = P.lang === 'en';

  // Lesefortschritt (CSS-Scroll-Animation, sonst per JS)
  const rp = document.createElement('div');
  rp.className = 'read-progress';
  rp.setAttribute('aria-hidden', 'true');
  document.body.append(rp);
  if (!CSS.supports('animation-timeline: scroll()')) {
    const upd = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      rp.style.setProperty('--rp', max > 0 ? String(scrollY / max) : '0');
    };
    addEventListener('scroll', upd, { passive: true });
    upd();
  }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lichtkegel auf der Startseite folgt dem Mauszeiger.
  const poster = document.querySelector('.poster');
  if (poster && !calm) {
    poster.addEventListener('pointermove', (e) => {
      const r = poster.getBoundingClientRect();
      poster.style.setProperty('--sx', `${e.clientX - r.left}px`);
      poster.style.setProperty('--sy', `${e.clientY - r.top}px`);
    }, { passive: true });
  }
  // Lichtpunkt auf Karten
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.teaser, .topic, .track, .point, .card');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // Dienstausweise kippen mit dem Mauszeiger, Hologramm-Glanz wandert mit.
  if (!calm) {
    document.querySelectorAll('.person').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
        card.style.setProperty('--rx', `${(0.5 - y) * 12}deg`);
        card.style.setProperty('--hx', `${x * 100}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); });
    });
  }

  // Stempel knallen beim Hineinscrollen auf, Klick stempelt erneut.
  const stamps = document.querySelectorAll('[data-stamp]');
  if (stamps.length && 'IntersectionObserver' in window && !calm) {
    const so = new IntersectionObserver((entries) => entries.forEach((ent) => {
      if (!ent.isIntersecting) return;
      setTimeout(() => ent.target.classList.add('slam'), 350);
      so.unobserve(ent.target);
    }), { threshold: 0.6 });
    stamps.forEach((st) => {
      st.style.opacity = '0';
      st.addEventListener('animationend', () => { st.style.opacity = ''; });
      st.parentElement.addEventListener('click', (e) => {
        if (e.target.closest('a, button, summary')) return;
        st.classList.remove('slam'); void st.offsetWidth; st.classList.add('slam');
      });
      so.observe(st);
    });
  }

  // Konfetti in Schwarz-Rot-Gold
  function confetti(x, y, n = 70) {
    if (calm) return;
    const colors = ['#555555', '#e5484d', '#e9c46a'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      c.style.background = colors[i % 3];
      document.body.append(c);
      const a = Math.random() * Math.PI * 2;
      const v = 140 + Math.random() * 260;
      c.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v + 320}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], { duration: 1200 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => c.remove();
    }
  }
  document.querySelectorAll('.ticket-day b, .release .live').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => confetti(e.clientX, e.clientY));
  });

  // Countdown: <div class="release" data-release="2026-11-07T00:00"> mit .clock b (Tage, Std., Min., Sek.)
  function berlinToUtc(local) {
    const [d, tm = '00:00'] = local.split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = tm.split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    const berlin = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const utc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
    return guess - (berlin - utc);
  }
  document.querySelectorAll('[data-release]').forEach((box) => {
    const target = berlinToUtc(box.dataset.release);
    const cells = box.querySelectorAll('.clock b');
    const tick = () => {
      const left = target - Date.now();
      if (left <= 0) {
        box.classList.add('is-out');
        document.querySelectorAll('[data-when-out]').forEach((el) => { el.textContent = en && el.dataset.whenOutEn ? el.dataset.whenOutEn : el.dataset.whenOut; });
        return false;
      }
      const parts = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
      cells.forEach((c, i) => {
        const v = String(parts[i]).padStart(2, '0');
        if (c.textContent !== v) {
          c.textContent = v;
          if (!calm) { c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); }
        }
      });
      return true;
    };
    if (tick()) { const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000); }
  });

  // Inhaltsverzeichnis mit aktivem Abschnitt
  document.querySelectorAll('.law-toc, .vs-nav').forEach((toc) => {
    if (!('IntersectionObserver' in window)) return;
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const io = new IntersectionObserver((entries) => entries.forEach((ent) => {
      if (!ent.isIntersecting) return;
      links.forEach((a) => {
        const on = a.getAttribute('href') === `#${ent.target.id}`;
        a.classList.toggle('on', on);
        if (on && toc.classList.contains('vs-nav')) { const box = a.parentElement; box.scrollTo({ left: a.offsetLeft - box.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' }); }
      });
    }), { rootMargin: '-30% 0px -60% 0px' });
    links.forEach((a) => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) io.observe(s); });
  });
  // Höhe des Kopfbereichs für die klebende Seitennavigation
  const head = document.querySelector('.site-header');
  const setHead = () => { if (head) document.documentElement.style.setProperty('--head-h', getComputedStyle(head).position === 'sticky' ? `${head.offsetHeight}px` : '0px'); };
  setHead(); addEventListener('resize', setHead);

  // ---------- Schnellsuche ----------
  const PAGES = [
    ['index.html', 'Startseite', 'Home'], ['verfassungsschutz.html', 'Verfassungsschutz und VSNOG', 'Domestic intelligence and VSNOG'],
    ['gesetze.html', 'Gesetzesvorhaben', 'Bills'], ['massnahmen.html', 'Maßnahmenplan', 'Action plan'],
    ['minister.html', 'Minister Dr. Niels Fiedel', 'Minister Dr. Niels Fiedel'], ['ministerium.html', 'Das Ministerium', 'The ministry'],
    ['presse.html', 'Pressemitteilungen', 'Press releases'], ['pressefotos.html', 'Pressefotos des Ministers', 'Press photos of the minister'], ['termine.html', 'Termine', 'Schedule'],
    ['kontakt.html', 'Kontakt', 'Contact'], ['buergerdialog.html', 'Bürgerdialog', 'Citizens\' dialogue'], ['impressum.html', 'Impressum', 'Legal notice'], ['datenschutz.html', 'Datenschutz', 'Privacy']
  ];
  const VS = [
    ['verfassungsschutz.html#leitung', 'Neue Leitung des BfV', 'Dr. Peter Thiel, Hans-Jörg Maaßen, Mathias Andreas Fuchs, Prof. Dr. Max Kruse'],
    ['verfassungsschutz.html#text', 'VSNOG: Gesetzestext', 'Drucksache 3/15, Artikel 1 bis 4'],
    ['verfassungsschutz.html#personal', 'Personelle Neuaufstellung des BfV', 'Entlassung der Ermittler und der bisherigen Amtsleitung']
  ];
  const icon = '<i data-ikon="lupe"></i>';
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || '');

  const wrap = document.createElement('div');
  wrap.className = 'cmdk';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="cmdk-box" role="dialog" aria-modal="true" aria-label="${en ? 'Search' : 'Suche'}">
      <div class="cmdk-in">${icon}<input type="search" autocomplete="off" spellcheck="false" placeholder="${en ? 'Search pages, bills, press releases …' : 'Seiten, Gesetze, Meldungen, Termine durchsuchen …'}" aria-controls="cmdk-list" aria-autocomplete="list"><kbd>Esc</kbd></div>
      <div class="cmdk-list" id="cmdk-list" role="listbox"></div>
      <div class="cmdk-foot"><span>↑ ↓ ${en ? 'navigate' : 'auswählen'}</span><span>↵ ${en ? 'open' : 'öffnen'}</span><span>${mac ? '⌘' : 'Strg'}+K</span></div>
    </div>`;
  document.body.append(wrap);
  const input = wrap.querySelector('input');
  const list = wrap.querySelector('.cmdk-list');
  let items = null;
  let sel = 0;
  let last = null;

  async function index() {
    if (items) return items;
    const base = PAGES.map(([href, de, enT]) => ({ g: en ? 'Pages' : 'Seiten', href, title: en ? enT : de, sub: '' }))
      .concat(VS.map(([href, title, sub]) => ({ g: en ? 'Domestic intelligence' : 'Verfassungsschutz', href, title, sub })));
    const safe = (n) => load(n).then((x) => (Array.isArray(x) ? x : [])).catch(() => []);
    const [laws, news, ms, ev] = await Promise.all([safe('gesetze'), safe('meldungen'), safe('massnahmen'), safe('termine')]);
    items = base
      .concat(laws.map((g) => ({ g: t('Gesetze'), href: `gesetze.html#g-${g.id}`, title: g.titel, sub: [g.kurz, t(g.stand)].filter(Boolean).join(' · '), extra: `${g.ziel || ''} ${g.kernpunkte || ''}` })))
      .concat(news.map((n) => ({ g: t('Presse'), href: `presse.html#${n.id}`, title: n.titel, sub: fmtDate(n.datum), extra: n.text })))
      .concat(ms.map((m) => ({ g: t('Maßnahmenplan'), href: `massnahmen.html#m-${m.id}`, title: m.titel, sub: [t(m.status), m.bereich].filter(Boolean).join(' · '), extra: m.beschreibung })))
      .concat(ev.map((e) => ({ g: t('Termine'), href: 'termine.html', title: e.titel, sub: `${fmtDate(e.datum)}${e.ort ? ` · ${e.ort}` : ''}` })));
    return items;
  }

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  async function render() {
    const all = await index();
    const q = norm(input.value.trim());
    const words = q.split(/\s+/).filter(Boolean);
    const hits = (words.length
      ? all.filter((it) => { const hay = norm(`${it.title} ${it.sub} ${it.extra || ''}`); return words.every((w) => hay.includes(w)); })
      : all.slice(0, 14)).slice(0, 40);
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    if (!hits.length) { list.innerHTML = `<div class="cmdk-empty">${en ? 'No results.' : 'Keine Treffer.'}</div>`; input.removeAttribute('aria-activedescendant'); return; }
    let g = '';
    list.innerHTML = hits.map((it, i) => {
      const head = it.g !== g ? `<div class="grp">${esc((g = it.g))}</div>` : '';
      return `${head}<a role="option" id="cmdk-${i}" href="${esc(it.href)}" aria-selected="${i === sel}"><span>${esc(it.title)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}<span class="k">↵</span></a>`;
    }).join('');
    input.setAttribute('aria-activedescendant', `cmdk-${sel}`);
  }
  function move(d) {
    const opts = [...list.querySelectorAll('a')];
    if (!opts.length) return;
    sel = (sel + d + opts.length) % opts.length;
    opts.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel)));
    opts[sel].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `cmdk-${sel}`);
  }
  function open() {
    last = document.activeElement;
    wrap.hidden = false;
    input.value = '';
    sel = 0;
    render();
    input.focus();
  }
  function close() {
    wrap.hidden = true;
    last?.focus?.();
  }
  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      const a = list.querySelector('a[aria-selected="true"]');
      if (a) { e.preventDefault(); wrap.hidden = true; location.href = a.href; }
    }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) wrap.hidden = true; });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (wrap.hidden) open(); else close(); }
    else if (e.key === 'Escape' && !wrap.hidden) close();
    else if (e.key === '/' && wrap.hidden && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); open(); }
  });
  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
})();
