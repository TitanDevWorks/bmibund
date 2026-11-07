// Gemeinsame Helfer: Daten laden, Escaping, Bausteine, Animationen.
window.BMIH = (() => {
  const PHASES = ['Tag 1–10', 'Tag 11–50', 'Tag 51–100'];
  const STATUSES = ['Offen', 'In Arbeit', 'Im Kabinett', 'Abgeschlossen'];
  const STATUS_KEY = { 'Offen': 'offen', 'In Arbeit': 'arbeit', 'Im Kabinett': 'kabinett', 'Abgeschlossen': 'fertig' };
  const NEWS_KIND = ['Pressemitteilung', 'Rede', 'Interview', 'Statement', 'Bekanntmachung'];
  const EVENT_KIND = ['Termin', 'Pressekonferenz', 'Kabinett', 'Bundestag', 'Reise'];
  const LAW_STAGES = ['In Vorbereitung', 'Referentenentwurf', 'Kabinett', 'Bundestag', 'Bundesrat', 'Verkündet', 'Gestoppt'];
  // Ohne prefs.js (Verwaltung) bleibt alles deutsch.
  const P = window.BMIH_PREFS || { lang: 'de', t: (x) => x, tPhase: (x) => x, locale: 'de-DE', translate() {} };
  const { t, tPhase } = P;
  // Datum immer in deutscher Zeit, damit Tageswechsel nicht nach UTC springen.
  const berlinDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
  const today = () => berlinDate.format(new Date());
  const START = Date.UTC(2026, 9, 30); // Amtsantritt 30.10.2026
  const DAY = Math.min(100, Math.max(1, Math.round((Date.parse(today()) - START) / 86400000) + 1));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const asDate = (iso) => new Date(`${iso}T12:00:00`);
  const dateFmt = new Intl.DateTimeFormat(P.locale, { day: '2-digit', month: 'long', year: 'numeric' });
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

  const statusBadge = (s) => `<span class="status" data-s="${STATUS_KEY[s] || 'offen'}">${esc(t(s))}</span>`;
  const bar = (p, label = true) => `
    <div class="prog">${label ? `<span>${t('Fortschritt')} <b>${p} %</b></span>` : ''}
      <div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${t('Fortschritt')}"><i data-p="${p}"></i></div>
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
      ['Phase', tPhase(m.phase)], ['Bereich', m.bereich], ['Zuständig', m.verantwortlich],
      ['Frist', m.frist ? fmtDate(m.frist) : ''], ['Grundlage', m.grundlage]
    ].filter(([, v]) => v);
    return `
      <details class="m-item reveal" data-s="${key}" id="m-${esc(m.id)}"${open ? ' open' : ''}>
        <summary>
          <div>
            <h3>${esc(m.titel)}</h3>
            <div class="meta">${statusBadge(m.status)}<span>${esc(tPhase(m.phase))}</span>${m.bereich ? `<span>${esc(m.bereich)}</span>` : ''}</div>
          </div>
          ${bar(p)}
          ${chevron}
        </summary>
        <div class="m-body">
          <p>${esc(m.beschreibung || t('Keine weitere Beschreibung.'))}</p>
          <dl class="m-facts">${facts.map(([k, v]) => `<dt>${t(k)}</dt><dd>${k === 'Frist' ? v : esc(v)}</dd>`).join('')}</dl>
        </div>
      </details>`;
  }

  function measureCard(m) {
    const key = STATUS_KEY[m.status] || 'offen';
    return `
      <article class="card-s" data-s="${key}">
        <div class="meta"><span>${esc(tPhase(m.phase))}</span>${m.bereich ? `<span>· ${esc(m.bereich)}</span>` : ''}</div>
        <h4><a href="massnahmen.html#m-${esc(m.id)}">${esc(m.titel)}</a></h4>
        ${bar(progressOf(m))}
      </article>`;
  }

  // Pressefotos (data/pressefotos.json, Dateien unter assets/presse/fiedel/).
  const FOTO_DIR = 'assets/presse/fiedel/';
  const fotoSrc = (f, size = '') => `${FOTO_DIR}${f.id}${size === 's' ? '-s.webp' : size === 'jpg' ? '.jpg' : '.webp'}`;
  const fotoTitle = (f) => (P.lang === 'en' && f.titelEn) || f.titel;
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Statische Datei, kein Backend nötig.
  const loadFotos = () => (cache['#fotos'] ||= fetch('data/pressefotos.json').then((r) => (r.ok ? r.json() : [])).catch(() => []));
  const FALLBACK = ['presse', 'portraet', 'ministerium', 'bundestag'];
  // Bild zu einer Meldung: festes Feld „bild“, sonst passendes Stichwort, sonst ein ruhiges Standardmotiv.
  // Einsatzlagen (Ausschreitungen) kommen nur bei passendem Stichwort.
  function fotoFor(n, fotos, used = new Set()) {
    if (!Array.isArray(fotos) || !fotos.length) return null;
    const fixed = n.bild && fotos.find((f) => f.id === n.bild);
    if (fixed) { used.add(fixed.id); return fixed; }
    const hay = ` ${fold(`${n.titel} ${n.text}`).replace(/[^a-z0-9]+/g, ' ')}`;
    // Bereits verwendete Bilder nur, wenn kein anderes passt.
    let best = null;
    let top = 0;
    for (const f of fotos) {
      const score = (f.tags || []).reduce((a, tag) => a + (hay.includes(` ${fold(tag)}`) ? 1 : 0), 0) - (used.has(f.id) ? 10 : 0);
      if (score > top) { top = score; best = f; }
    }
    if (!best) {
      const pool = fotos.filter((f) => FALLBACK.includes(f.thema) && !used.has(f.id));
      const list = pool.length ? pool : fotos.filter((f) => FALLBACK.includes(f.thema));
      const h = [...String(n.id || n.titel)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      best = list[h % list.length] || fotos[0];
    }
    used.add(best.id);
    return best;
  }
  const fotoImg = (f, size, cls = '', lazy = true) => (f ? `<img${cls ? ` class="${cls}"` : ''} src="${esc(fotoSrc(f, size))}" alt="${esc(fotoTitle(f))}" width="${f.w}" height="${f.h}"${lazy ? ' loading="lazy"' : ''} decoding="async">` : '');

  function newsTeaser(n, foto, size = 's') {
    return `
      <a class="teaser reveal${foto ? ' has-img' : ''}" href="presse.html#${esc(n.id)}">
        ${foto ? `<span class="teaser-img">${fotoImg(foto, size)}</span>` : ''}
        <div class="meta"><span class="tag">${esc(t(n.kategorie || 'Pressemitteilung'))}</span><time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time></div>
        <h3>${esc(n.titel)}</h3>
        <p>${esc(n.teaser || n.text)}</p>
      </a>`;
  }

  const monthFmt = new Intl.DateTimeFormat(P.locale, { month: 'short' });
  const timeLabel = (z) => (P.lang === 'en' ? z : `${z} Uhr`);
  function eventItem(e) {
    const d = asDate(e.datum);
    const ok = !Number.isNaN(d.getTime());
    const past = e.datum < today();
    return `
      <article class="event reveal${past ? ' past' : ''}">
        <div class="cal" aria-hidden="true"><small>${ok ? esc(monthFmt.format(d)) : ''}</small><b>${ok ? d.getDate() : ''}</b></div>
        <div>
          <div class="meta"><span class="tag">${esc(t(e.art || 'Termin'))}</span><time datetime="${esc(e.datum)}">${fmtDate(e.datum)}${e.zeit ? `, ${esc(timeLabel(e.zeit))}` : ''}</time></div>
          <h3>${esc(e.titel)}</h3>
          ${e.ort ? `<p>${esc(e.ort)}</p>` : ''}
          ${e.beschreibung ? `<p>${esc(e.beschreibung)}</p>` : ''}
        </div>
      </article>`;
  }

  // Gesetzgebungsverfahren als Stufenleiste. „Gestoppt“ steht außerhalb der Reihenfolge.
  const LAW_PATH = LAW_STAGES.slice(0, 6);
  const LAW_KEY = { 'Verkündet': 'fertig', 'Gestoppt': 'stop', 'In Vorbereitung': 'offen' };
  function lawSteps(stand) {
    const at = LAW_PATH.indexOf(stand);
    return `<ol class="steps${stand === 'Gestoppt' ? ' stopped' : ''}" aria-label="${esc(t('Stand'))}: ${esc(t(stand))}">${LAW_PATH.map((s, i) =>
      `<li class="${i < at ? 'done' : ''}${i === at ? ' now' : ''}"${i === at ? ' aria-current="step"' : ''}><span>${esc(t(s))}</span></li>`).join('')}</ol>`;
  }
  const dayDate = (n) => new Date(START + (n - 1) * 86400000).toISOString().slice(0, 10);
  const zday = (v) => (Number.isInteger(Number(v)) ? Math.min(100, Math.max(1, Number(v))) : 0);
  function dueLabel(n, stand) {
    if (!n || ['Verkündet', 'Gestoppt'].includes(stand)) return '';
    const diff = n - DAY;
    if (diff === 0) return t('heute');
    if (diff < 0) return t('überfällig');
    return P.lang === 'en' ? `in ${diff} ${diff === 1 ? 'day' : 'days'}` : `noch ${diff} ${diff === 1 ? 'Tag' : 'Tage'}`;
  }
  function lawItem(raw) {
    const g = { ...raw, zieltag: zday(raw.zieltag) };
    const key = LAW_KEY[g.stand] || 'arbeit';
    const points = String(g.kernpunkte || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const overdue = g.zieltag && g.zieltag < DAY && !['Verkündet', 'Gestoppt'].includes(g.stand);
    return `
      <article class="law reveal" id="g-${esc(g.id)}" data-s="${key}">
        <header class="law-head">
          <div>
            <div class="meta">${g.kurz ? `<span class="tag">${esc(g.kurz)}</span>` : ''}${g.bereich ? `<span>${esc(g.bereich)}</span>` : ''}<span class="status" data-s="${key}">${esc(t(g.stand))}</span></div>
            <h3>${esc(g.titel)}</h3>
          </div>
          ${g.zieltag ? `<div class="law-day${overdue ? ' late' : ''}"><small>${esc(t('Zieltag'))}</small><b>${g.zieltag}</b><span>${esc(dueLabel(g.zieltag, g.stand))}</span></div>` : ''}
        </header>
        ${lawSteps(g.stand)}
        <div class="law-body">
          <div>
            ${g.ziel ? `<p class="law-goal">${esc(g.ziel)}</p>` : ''}
            ${points.length ? `<h4>${esc(t('Kernpunkte'))}</h4><ul class="law-points">${points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          </div>
          <dl class="m-facts">
            ${g.naechsterSchritt ? `<dt>${esc(t('Nächster Schritt'))}</dt><dd>${esc(g.naechsterSchritt)}</dd>` : ''}
            ${g.zieltag ? `<dt>${esc(t('Zieltag'))}</dt><dd>${esc(t('Tag'))} ${g.zieltag} · ${fmtDate(dayDate(g.zieltag))}</dd>` : ''}
            ${g.grundlage ? `<dt>${esc(t('Grundlage'))}</dt><dd>${esc(g.grundlage)}</dd>` : ''}
          </dl>
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
    PHASES, STATUSES, STATUS_KEY, NEWS_KIND, EVENT_KIND, LAW_STAGES, DAY, t, tPhase, P,
    esc, fmtDate, today, load, byDateDesc, byDateAsc, progressOf, dayDate, dueLabel,
    zday, statusBadge, bar, fillBars, measureItem, measureCard, newsTeaser, loadFotos, fotoFor, fotoSrc, fotoTitle, fotoImg, eventItem, lawSteps, lawItem, reveal, countUp, transition
  };
})();
