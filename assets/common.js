// Gemeinsame Helfer: Daten laden, Escaping, Bausteine, Animationen.
window.BMIH = (() => {
  const PHASES = ['Tag 1–10', 'Tag 11–50', 'Tag 51–100'];
  const STATUSES = ['Offen', 'In Arbeit', 'Im Kabinett', 'Abgeschlossen'];
  const STATUS_KEY = { 'Offen': 'offen', 'In Arbeit': 'arbeit', 'Im Kabinett': 'kabinett', 'Abgeschlossen': 'fertig' };
  const NEWS_KIND = ['Pressemitteilung', 'Rede', 'Interview', 'Statement'];
  const EVENT_KIND = ['Termin', 'Pressekonferenz', 'Kabinett', 'Bundestag', 'Reise'];
  // Datum immer in deutscher Zeit, damit Tageswechsel nicht nach UTC springen.
  const berlinDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
  const today = () => berlinDate.format(new Date());
  const START = Date.UTC(2026, 9, 30); // Amtsantritt 30.10.2026
  const DAY = Math.min(100, Math.max(1, Math.round((Date.parse(today()) - START) / 86400000) + 1));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const asDate = (iso) => new Date(`${iso}T12:00:00`);
  const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtDate = (iso) => {
    const d = asDate(iso);
    return Number.isNaN(d.getTime()) ? esc(iso) : dateFmt.format(d);
  };

  // Live aus dem Backend, sonst statische Kopie.
  const cache = {};
  function load(name) {
    cache[name] ||= (async () => {
      try {
        const res = await fetch(`/api/${name}`, { headers: { Accept: 'application/json' } });
        if (res.ok) return await res.json();
      } catch (_) { /* Fallback */ }
      const res = await fetch(`data/${name}.json`);
      return res.json();
    })();
    return cache[name];
  }

  const byDateDesc = (a, b) => String(b.datum).localeCompare(String(a.datum));
  const byDateAsc = (a, b) => `${a.datum} ${a.zeit || ''}`.localeCompare(`${b.datum} ${b.zeit || ''}`);
  const progressOf = (m) => (Number.isInteger(m.fortschritt) ? m.fortschritt : ({ 'Abgeschlossen': 100, 'Im Kabinett': 75, 'In Arbeit': 40 }[m.status] || 0));

  const statusBadge = (s) => `<span class="status" data-s="${STATUS_KEY[s] || 'offen'}">${esc(s)}</span>`;
  const bar = (p, label = true) => `
    <div class="prog">${label ? `<span>Fortschritt <b>${p} %</b></span>` : ''}
      <div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Fortschritt"><i data-p="${p}"></i></div>
    </div>`;

  // Balken nach dem Einfügen animiert füllen.
  function fillBars(root = document) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll('.bar > i[data-p]').forEach((i) => { i.style.setProperty('--p', `${i.dataset.p}%`); });
    }));
  }

  const chevron = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function measureItem(m, open = false) {
    const key = STATUS_KEY[m.status] || 'offen';
    const p = progressOf(m);
    const facts = [
      ['Phase', m.phase], ['Bereich', m.bereich], ['Zuständig', m.verantwortlich],
      ['Frist', m.frist ? fmtDate(m.frist) : ''], ['Grundlage', m.grundlage]
    ].filter(([, v]) => v);
    return `
      <details class="m-item reveal" data-s="${key}" id="m-${esc(m.id)}"${open ? ' open' : ''}>
        <summary>
          <div>
            <h3>${esc(m.titel)}</h3>
            <div class="meta">${statusBadge(m.status)}<span>${esc(m.phase)}</span>${m.bereich ? `<span>${esc(m.bereich)}</span>` : ''}</div>
          </div>
          ${bar(p)}
          ${chevron}
        </summary>
        <div class="m-body">
          <p>${esc(m.beschreibung || 'Keine weitere Beschreibung.')}</p>
          <dl class="m-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${k === 'Frist' ? v : esc(v)}</dd>`).join('')}</dl>
        </div>
      </details>`;
  }

  function measureCard(m) {
    const key = STATUS_KEY[m.status] || 'offen';
    return `
      <article class="card-s" data-s="${key}">
        <div class="meta"><span>${esc(m.phase)}</span>${m.bereich ? `<span>· ${esc(m.bereich)}</span>` : ''}</div>
        <h4><a href="massnahmen.html#m-${esc(m.id)}">${esc(m.titel)}</a></h4>
        ${bar(progressOf(m))}
      </article>`;
  }

  function newsTeaser(n) {
    return `
      <a class="teaser reveal" href="presse.html#${esc(n.id)}">
        <div class="meta"><span class="tag">${esc(n.kategorie || 'Pressemitteilung')}</span><time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time></div>
        <h3>${esc(n.titel)}</h3>
        <p>${esc(n.text)}</p>
      </a>`;
  }

  const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function eventItem(t) {
    const d = asDate(t.datum);
    const past = t.datum < today();
    return `
      <article class="event reveal${past ? ' past' : ''}">
        <div class="cal" aria-hidden="true"><small>${MONTHS[d.getMonth()] || ''}</small><b>${d.getDate() || ''}</b></div>
        <div>
          <div class="meta"><span class="tag">${esc(t.art || 'Termin')}</span><time datetime="${esc(t.datum)}">${fmtDate(t.datum)}${t.zeit ? `, ${esc(t.zeit)} Uhr` : ''}</time></div>
          <h3>${esc(t.titel)}</h3>
          ${t.ort ? `<p>${esc(t.ort)}</p>` : ''}
          ${t.beschreibung ? `<p>${esc(t.beschreibung)}</p>` : ''}
        </div>
      </article>`;
  }

  // Einblenden beim Scrollen
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -6% 0px' })
    : null;
  function reveal(root = document) {
    root.querySelectorAll('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
    fillBars(root);
  }
  document.addEventListener('DOMContentLoaded', () => reveal());

  // Zahlen hochzählen
  function countUp(el, to) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !to) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(to * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const transition = (fn) => (document.startViewTransition ? document.startViewTransition(fn) : fn());

  return {
    PHASES, STATUSES, STATUS_KEY, NEWS_KIND, EVENT_KIND, DAY,
    esc, fmtDate, today, load, byDateDesc, byDateAsc, progressOf,
    statusBadge, bar, fillBars, measureItem, measureCard, newsTeaser, eventItem, reveal, countUp, transition
  };
})();
