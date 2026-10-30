(() => {
  const PHASES = ['Tag 1–10', 'Tag 11–50', 'Tag 51–100'];
  const STATUSES = ['Offen', 'In Arbeit', 'Im Kabinett', 'Abgeschlossen'];
  const STATUS_CLASS = {
    'Offen': 'offen',
    'In Arbeit': 'arbeit',
    'Im Kabinett': 'kabinett',
    'Abgeschlossen': 'fertig'
  };

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  // Load from the backend API; fall back to the bundled JSON when it is not reachable.
  async function load(name) {
    try {
      const res = await fetch(`/api/${name}`, { headers: { Accept: 'application/json' } });
      if (res.ok) return { data: await res.json(), live: true };
    } catch (_) { /* fall through */ }
    const res = await fetch(`data/${name}.json`);
    return { data: await res.json(), live: false };
  }

  function phaseOrder(p) {
    const i = PHASES.indexOf(p);
    return i === -1 ? PHASES.length : i;
  }

  function fillSelect(el, values) {
    values.forEach((v) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    });
  }

  function renderStats(items) {
    const count = (s) => items.filter((m) => m.status === s).length;
    const done = count('Abgeschlossen');
    $('#stat-done').textContent = done;
    $('#stat-total').textContent = items.length;
    $('#stat-arbeit').textContent = count('In Arbeit');
    $('#stat-offen').textContent = count('Offen');
    $('#stat-kabinett').textContent = count('Im Kabinett');
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    requestAnimationFrame(() => { $('#stat-bar').style.width = `${Math.max(pct, 2)}%`; });
  }

  function renderTimeline(items) {
    const phase = $('#filter-phase').value;
    const status = $('#filter-status').value;
    const filtered = items.filter((m) => (!phase || m.phase === phase) && (!status || m.status === status));
    const root = $('#timeline');

    if (!filtered.length) {
      root.innerHTML = '<div class="empty">Keine Maßnahmen für diese Auswahl.</div>';
      return;
    }

    const groups = new Map();
    filtered
      .slice()
      .sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase) || STATUSES.indexOf(b.status) - STATUSES.indexOf(a.status))
      .forEach((m) => {
        if (!groups.has(m.phase)) groups.set(m.phase, []);
        groups.get(m.phase).push(m);
      });

    root.innerHTML = [...groups.entries()].map(([p, list]) => `
      <div class="phase">
        <div class="phase-head"><h3>${esc(p)}</h3><span>${list.length} Maßnahme${list.length === 1 ? '' : 'n'}</span></div>
        <div class="measures">
          ${list.map((m) => `
            <article class="measure" data-status="${esc(m.status)}">
              <div class="measure-meta">
                <span class="badge status-${STATUS_CLASS[m.status] || 'offen'}"><span class="dot s-${STATUS_CLASS[m.status] || 'offen'}"></span>${esc(m.status)}</span>
                ${m.bereich ? `<span class="badge">${esc(m.bereich)}</span>` : ''}
              </div>
              <h4>${esc(m.titel)}</h4>
              ${m.beschreibung ? `<p>${esc(m.beschreibung)}</p>` : ''}
              ${m.grundlage ? `<div class="measure-foot">Grundlage: ${esc(m.grundlage)}</div>` : ''}
            </article>`).join('')}
        </div>
      </div>`).join('');
  }

  function renderNews(items) {
    const root = $('#news');
    if (!items.length) {
      root.innerHTML = '<div class="empty">Noch keine Meldungen.</div>';
      return;
    }
    const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    root.innerHTML = items
      .slice()
      .sort((a, b) => String(b.datum).localeCompare(String(a.datum)))
      .map((n) => `
        <article>
          <time datetime="${esc(n.datum)}">${esc(fmt.format(new Date(n.datum)))}</time>
          <h3>${esc(n.titel)}</h3>
          <p>${esc(n.text)}</p>
        </article>`).join('');
  }

  async function init() {
    fillSelect($('#filter-phase'), PHASES);
    fillSelect($('#filter-status'), STATUSES);

    const [massnahmen, meldungen] = await Promise.all([load('massnahmen'), load('meldungen')]);
    const items = massnahmen.data;

    renderStats(items);
    renderTimeline(items);
    renderNews(meldungen.data);

    $('#filter-phase').addEventListener('change', () => renderTimeline(items));
    $('#filter-status').addEventListener('change', () => renderTimeline(items));
    $('#data-source').textContent = massnahmen.live
      ? 'Stand: live aus dem Ministeriums-Backend.'
      : 'Stand: statische Kopie (Backend nicht erreichbar).';
  }

  init().catch((err) => {
    console.error(err);
    $('#timeline').innerHTML = '<div class="empty">Maßnahmen konnten nicht geladen werden.</div>';
  });
})();
