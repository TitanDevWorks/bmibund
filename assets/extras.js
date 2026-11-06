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

  // Lichtpunkt folgt dem Mauszeiger
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.tile, .teaser, .topic, .track, .card, .person');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

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
      cells.forEach((c, i) => { c.textContent = String(parts[i]).padStart(2, '0'); });
      return true;
    };
    if (tick()) { const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000); }
  });

  // Inhaltsverzeichnis mit aktivem Abschnitt
  const toc = document.querySelector('.law-toc');
  if (toc && 'IntersectionObserver' in window) {
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const io = new IntersectionObserver((entries) => entries.forEach((ent) => {
      if (!ent.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${ent.target.id}`));
    }), { rootMargin: '-30% 0px -60% 0px' });
    links.forEach((a) => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) io.observe(s); });
  }

  // ---------- Schnellsuche ----------
  const PAGES = [
    ['index.html', 'Startseite', 'Home'], ['verfassungsschutz.html', 'Verfassungsschutz und VSNOG', 'Domestic intelligence and VSNOG'],
    ['gesetze.html', 'Gesetzesvorhaben', 'Bills'], ['massnahmen.html', 'Maßnahmenplan', 'Action plan'],
    ['minister.html', 'Minister Dr. Niels Fiedel', 'Minister Dr. Niels Fiedel'], ['ministerium.html', 'Das Ministerium', 'The ministry'],
    ['presse.html', 'Pressemitteilungen', 'Press releases'], ['termine.html', 'Termine', 'Schedule'],
    ['kontakt.html', 'Kontakt', 'Contact'], ['impressum.html', 'Impressum', 'Legal notice'], ['datenschutz.html', 'Datenschutz', 'Privacy']
  ];
  const VS = [
    ['verfassungsschutz.html#leitung', 'Neue Leitung des BfV', 'Dr. Peter Thiel, Hans-Jörg Maaßen, Mathias Andreas Fuchs, Prof. Dr. Max Kruse'],
    ['verfassungsschutz.html#text', 'VSNOG: Gesetzestext', 'Drucksache 3/15, Artikel 1 bis 4'],
    ['verfassungsschutz.html#personal', 'Personelle Neuaufstellung des BfV', 'Entlassung der Ermittler und der bisherigen Amtsleitung']
  ];
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
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
