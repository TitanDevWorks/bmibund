// Seitenlogik, gesteuert über <body data-page="...">.
(() => {
  const B = window.BMIH;
  const { esc, fmtDate, load, loadFotos, fotoFor, fotoSrc, fotoTitle, fotoImg, byDateDesc, byDateAsc, progressOf, measureItem, measureCard, newsTeaser, eventItem, lawItem, lawSteps, dueLabel, zday, reveal, countUp, transition, PHASES, STATUSES, STATUS_KEY, NEWS_KIND, LAW_STAGES, LAW_DONE, LAW_KEY, DAY, t, tPhase, P } = B;
  const $ = (s) => document.querySelector(s);
  const decode = (x) => { try { return decodeURIComponent(x); } catch (_) { return ''; } };
  const empty = (text) => `<div class="empty">${esc(t(text))}</div>`;
  const plural = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;
  // Werte bleiben deutsch (wie in der Datenbank), angezeigt wird die Übersetzung.
  const fillOptions = (select, values, label = t) => {
    select.insertAdjacentHTML('beforeend', values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join(''));
  };

  function upcoming(events, limit) {
    const now = B.today();
    return events.filter((e) => e.datum >= now).sort(byDateAsc).slice(0, limit);
  }

  async function applySettings() {
    const s = await load('settings').catch(() => null);
    if (!s) return;
    const set = (sel, v) => { const el = $(sel); if (el && v) el.textContent = v; };
    const en = P.lang === 'en';
    const title = (en && s.heroTitelEn) || s.heroTitel;
    const h = $('#hero-title');
    // Plakat-Titel: jeder Satz eine eigene Zeile.
    if (h && title) h.innerHTML = String(title).split(/(?<=[.!?])\s+/).filter(Boolean).map((w) => `<span>${esc(w)}</span>`).join('');
    set('#hero-text', (en && s.heroTextEn) || s.heroText);
    set('#quote', (en && s.ministerZitatEn) || s.ministerZitat);
  }

  function topicCounts(ms) {
    document.querySelectorAll('#topics .topic[data-bereich]').forEach((tile) => {
      const n = ms.filter((m) => m.bereich === tile.dataset.bereich).length;
      tile.querySelector('.count').textContent = n ? `${plural(n, 'Maßnahme', 'Maßnahmen')} ${t('im Plan')}` : '';
    });
  }

  // Countdown bis zum nächsten Termin (Berliner Zeit, ohne Uhrzeit = 9 Uhr).
  // Bürgerdialog: Frage und Antwort als Gesprächskarte
  function bdItem(x) {
    return `
      <article class="bd-item reveal" id="f-${esc(x.id)}">
        <div class="bd-frage">
          <span class="bd-av" aria-hidden="true">${esc((x.name || '?').slice(0, 1))}</span>
          <div><div class="bd-meta"><b>${esc(x.name)}</b><span>${esc(t(x.betreff))}</span><time datetime="${esc(x.eingang)}">${fmtDate(x.eingang)}</time></div>
          <p>${esc(x.frage)}</p></div>
        </div>
        <div class="bd-antwort">
          <img src="assets/img/minister-fiedel-av.webp" alt="" width="40" height="40" loading="lazy">
          <div><div class="bd-meta"><b>${esc(t('Antwort des Ministeriums'))}</b><time datetime="${esc(x.antwortDatum)}">${fmtDate(x.antwortDatum)}</time></div>
          <p>${esc(x.antwort)}</p></div>
        </div>
      </article>`;
  }

  // 100-Tage-Zeitstrahl: Phasen, heutiger Tag, Zieltage der Gesetze und Termine
  function zeitstrahl(root, laws, events) {
    if (!root) return;
    const pos = (tag) => ((Math.min(100, Math.max(1, tag)) - 1) / 99) * 100;
    const PH = [[1, 10, PHASES[0]], [11, 50, PHASES[1]], [51, 100, PHASES[2]]];
    const ziel = laws.map((g) => ({ ...g, zieltag: zday(g.zieltag) })).filter((g) => g.zieltag && g.stand !== 'Gestoppt').sort((a, b) => a.zieltag - b.zieltag);
    const tagVon = (d) => Math.round((Date.parse(d) - Date.parse(B.dayDate(1))) / 86400000) + 1;
    const termine = events.map((e) => ({ ...e, tag: tagVon(e.datum) })).filter((e) => e.tag >= 1 && e.tag <= 100);
    const naechste = ziel.filter((g) => g.zieltag >= DAY && !LAW_DONE.includes(g.stand)).slice(0, 3);
    root.innerHTML = `
      <div class="zs-phasen">${PH.map(([a, b, n]) => `<div style="--w:${b - a + 1}" class="${DAY >= a && DAY <= b ? 'jetzt' : DAY > b ? 'vorbei' : ''}"><b>${esc(tPhase(n))}</b><span>${a === 1 ? esc(t('Sofortprogramm')) : a === 11 ? esc(t('Gesetze auf den Weg')) : esc(t('Umsetzung'))}</span></div>`).join('')}</div>
      <div class="zs-linie" role="img" aria-label="${esc(`${t('Amtstag')} ${DAY} ${t('von 100')}`)}">
        <i class="zs-fort" style="width:${pos(DAY)}%"></i>
        ${termine.map((e) => `<i class="zs-tick" style="left:${pos(e.tag)}%" title="${esc(`${fmtDate(e.datum)} · ${e.titel}`)}"></i>`).join('')}
        ${ziel.map((g, i) => `<a class="zs-pkt${g.stand === 'Verkündet' ? ' fertig' : g.stand === 'Abgelehnt' ? ' abgelehnt' : g.zieltag < DAY ? ' spaet' : ''}${i % 2 ? ' unten' : ''}" style="left:${pos(g.zieltag)}%" href="gesetze.html#g-${esc(g.id)}" title="${esc(`${g.kurz || g.titel} · ${t(g.stand)}`)}"><span>${esc(g.kurz || g.titel)}<small>${g.stand === 'Abgelehnt' ? esc(t('Abgelehnt')) : `${esc(t('Tag'))} ${g.zieltag}`}</small></span></a>`).join('')}
        <span class="zs-heute${pos(DAY) < 10 ? ' links' : pos(DAY) > 90 ? ' rechts' : ''}" style="left:${pos(DAY)}%"><b>${esc(t('Heute'))} · ${esc(t('Tag'))} ${DAY}</b></span>
      </div>
      <div class="zs-skala"><span>${esc(t('Tag'))} 1</span><span>${esc(t('Tag'))} 50</span><span>${esc(t('Tag'))} 100</span></div>
      ${naechste.length ? `<div class="zs-next">${naechste.map((g) => `
        <a href="gesetze.html#g-${esc(g.id)}"><span class="mono-label">${esc(t('Meilenstein'))} · ${esc(t('Tag'))} ${g.zieltag}</span><b>${esc(g.titel)}</b><span class="muted">${esc(dueLabel(g.zieltag, g.stand))} · ${esc(t(g.stand))}</span></a>`).join('')}</div>` : ''}`;
  }

  function startCountdown(ev) {
    const box = $('#countdown');
    if (!box || !ev) return;
    const [y, mo, d] = ev.datum.split('-').map(Number);
    const [h, mi] = (ev.zeit || '09:00').split(':').map(Number);
    // Berlin ist UTC+1 (Winter) bzw. UTC+2 (Sommer); Abweichung über Intl bestimmen.
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const berlin = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const utc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
    const target = guess - (berlin - utc);
    const tick = () => {
      const left = target - Date.now();
      if (left < -2 * 3600000) { box.hidden = true; return; }
      const dd = Math.floor(left / 86400000);
      const hh = Math.floor((left % 86400000) / 3600000);
      const mm = Math.floor((left % 3600000) / 60000);
      const when = left <= 0 ? esc(t('läuft gerade'))
        : `<b>${dd}</b> ${esc(P.lang === 'en' ? (dd === 1 ? 'day' : 'days') : (dd === 1 ? 'Tag' : 'Tage'))} <b>${hh}</b> ${esc(t('Std.'))} <b>${mm}</b> ${esc(t('Min.'))}`;
      box.innerHTML = `<span>${esc(P.lang === 'en' ? 'Next:' : 'Nächster Termin:')} <strong>${esc(ev.titel)}</strong></span><span>${left > 0 ? 'in ' : ''}${when}</span>`;
      box.hidden = false;
    };
    tick();
    setInterval(tick, 30000);
  }

  // Fotostreifen aus ausgewählten Pressefotos, jeweils mit Link ins Bildarchiv.
  function fotoStrip(root, fotos, ids) {
    if (!root) return;
    const list = ids.map((id) => fotos.find((f) => f.id === id)).filter(Boolean);
    root.innerHTML = list.map((f, i) => `
      <a class="strip-item reveal" style="--d:${(i * 0.05).toFixed(2)}s" href="pressefotos.html#${esc(f.id)}">${fotoImg(f, 's')}<span>${esc(fotoTitle(f))}</span></a>`).join('');
    root.hidden = !list.length;
  }

  const THEMEN = [['portraet', 'Porträts'], ['bundestag', 'Bundestag'], ['ministerium', 'Im Ministerium'], ['presse', 'Presse und Medien'],
    ['sicherheit', 'Innere Sicherheit'], ['einsatz', 'Einsatzlagen'], ['migration', 'Migration'], ['vorort', 'Vor Ort'], ['berlin', 'Berlin']];

  const pages = {
    async pressefotos() {
      const fotos = await loadFotos();
      const themen = THEMEN.filter(([k]) => fotos.some((f) => f.thema === k));
      const chips = $('#foto-themen');
      chips.innerHTML = [['', 'Alle'], ...themen].map(([k, l]) => `<button type="button" data-thema="${k}" aria-pressed="${!k}">${esc(t(l))} <small>${k ? fotos.filter((f) => f.thema === k).length : fotos.length}</small></button>`).join('');
      const grid = $('#fotos');
      const credit = 'Foto: BMIH (KI-generiert)';
      grid.innerHTML = fotos.map((f) => `
        <figure class="foto reveal" id="${esc(f.id)}" data-thema="${esc(f.thema)}">
          <button type="button" class="foto-open" data-id="${esc(f.id)}" aria-label="${esc(t('Groß anzeigen'))}: ${esc(fotoTitle(f))}">${fotoImg(f, 's')}</button>
          <figcaption><b>${esc(fotoTitle(f))}</b><span>${esc(t((THEMEN.find(([k]) => k === f.thema) || [])[1] || ''))} · <code>${esc(f.id)}</code></span>
            <a href="${esc(fotoSrc(f, 'jpg'))}" download="fiedel-${esc(f.id)}.jpg">${esc(t('JPG laden'))}</a></figcaption>
        </figure>`).join('');
      chips.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        chips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        transition(() => grid.querySelectorAll('.foto').forEach((el) => { el.hidden = !!b.dataset.thema && el.dataset.thema !== b.dataset.thema; }));
      });

      // Großansicht mit Bildunterschrift zum Kopieren
      const dlg = $('#foto-dlg');
      const show = (f) => {
        if (!f) return;
        dlg.querySelector('img').replaceWith(Object.assign(document.createElement('img'), { src: fotoSrc(f), alt: fotoTitle(f), width: f.w, height: f.h }));
        dlg.querySelector('h2').textContent = fotoTitle(f);
        const cap = `${fotoTitle(f)}. ${credit}`;
        dlg.querySelector('.cap').textContent = cap;
        dlg.querySelector('[data-copy]').dataset.copy = cap;
        dlg.querySelector('.dl').href = fotoSrc(f, 'jpg');
        dlg.querySelector('.dl').setAttribute('download', `fiedel-${f.id}.jpg`);
        dlg.querySelector('.id').textContent = f.id;
        if (!dlg.open) dlg.showModal();
        history.replaceState(null, '', `#${f.id}`);
      };
      grid.addEventListener('click', (e) => { const b = e.target.closest('.foto-open'); if (b) show(fotos.find((f) => f.id === b.dataset.id)); });
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
        const c = e.target.closest('[data-copy]');
        if (c) navigator.clipboard?.writeText(c.dataset.copy).then(() => { c.textContent = t('Kopiert'); setTimeout(() => { c.textContent = t('Bildunterschrift kopieren'); }, 1600); });
      });
      dlg.addEventListener('close', () => history.replaceState(null, '', location.pathname));
      reveal();
      const hash = decode(location.hash.slice(1));
      if (hash) { document.getElementById(hash)?.scrollIntoView({ block: 'center' }); show(fotos.find((f) => f.id === hash)); }
    },

    async start() {
      applySettings();
      const [ms, news, events, laws, fotos] = await Promise.all([load('massnahmen'), load('meldungen'), load('termine'), load('gesetze').catch(() => []), loadFotos()]);

      $('#sb-date').textContent = `${t('Stand')} ${fmtDate(B.today())}`;
      countUp($('#day-num'), DAY);
      const dayBar = $('#day-bar');
      dayBar.dataset.p = DAY;
      dayBar.style.setProperty('--full', `${(100 / Math.max(DAY, 1)) * 100}%`);
      document.querySelectorAll('[data-count]').forEach((el) =>
        countUp(el, ms.filter((m) => m.status === el.dataset.count).length));
      const total = ms.length ? Math.round(ms.reduce((a, m) => a + progressOf(m), 0) / ms.length) : 0;
      $('#total-p').textContent = `${total} %`;
      $('#total-bar').dataset.p = total;

      const run = $('#ticker-run');
      if (run) {
        const top = news.slice().sort(byDateDesc).slice(0, 6);
        const row = top.map((n) => `<a href="presse.html#${esc(n.id)}"><time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time>${esc(n.titel)}</a>`).join('');
        // Doppelt, damit das Laufband nahtlos weiterläuft.
        run.innerHTML = top.length ? row + row.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ') : '';
        run.closest('.ticker').hidden = !top.length;
      }

      const used = new Set(['brandenburger-tor']);
      const obenZuerst = (a, b) => (b.oben === true) - (a.oben === true) || byDateDesc(a, b);
      $('#news').innerHTML = news.length ? news.slice().sort(obenZuerst).slice(0, 3)
        .map((n, i) => newsTeaser(n, fotoFor(n, fotos, used), i ? 's' : '')).join('') : empty('Noch keine Meldungen.');
      fotoStrip($('#foto-strip'), fotos, ['rede-plenum', 'lage-polizei', 'buerger-altstadt', 'buero-unterschrift', 'pressekonferenz']);

      const current = ms.filter((m) => m.status === 'In Arbeit' || m.status === 'Im Kabinett')
        .sort((a, b) => progressOf(b) - progressOf(a)).slice(0, 5);
      $('#current').innerHTML = current.length ? current.map((m) => measureItem(m)).join('') : empty('Aktuell ist keine Maßnahme in Bearbeitung.');

      const next = upcoming(events, 3);
      $('#events').innerHTML = next.length ? next.map(eventItem).join('') : empty('Keine anstehenden Termine.');
      const n = upcoming(events).length;
      $('#events-count').textContent = n ? `${plural(n, 'anstehender Termin', 'anstehende Termine')}` : '';
      topicCounts(ms);

      const open = laws.map((g) => ({ ...g, zieltag: zday(g.zieltag) })).filter((g) => g.stand !== 'Gestoppt').sort((a, b) => (a.zieltag || 999) - (b.zieltag || 999)).slice(0, 6);
      $('#laws').innerHTML = open.length ? open.map((g) => `
        <a class="track reveal" href="gesetze.html#g-${esc(g.id)}">
          <div class="meta">${g.kurz ? `<span class="tag">${esc(g.kurz)}</span>` : ''}${g.zieltag ? `<span>${esc([`${t('Zieltag')} ${g.zieltag}`, dueLabel(g.zieltag, g.stand)].filter(Boolean).join(' · '))}</span>` : ''}</div>
          <h3>${esc(g.titel)}</h3>
          ${lawSteps(g.stand)}
          <span class="status" data-s="${LAW_KEY[g.stand] || 'arbeit'}">${esc(t(g.stand))}</span>
        </a>`).join('') : empty('Noch keine Gesetzesvorhaben.');

      startCountdown(upcoming(events, 1)[0]);
      zeitstrahl($('#zeitstrahl'), laws, events);
      load('buergerdialog').then((bd) => {
        if (!Array.isArray(bd) || !bd.length) return;
        $('#bd-start').innerHTML = bd.slice(0, 2).map(bdItem).join('');
        $('#bd-home').hidden = false;
        reveal($('#bd-home'));
      }).catch(() => {});
      reveal();
    },

    async buergerdialog() {
      const liste = await load('buergerdialog').catch(() => []);
      const q = $('#bd-q');
      const render = () => {
        const s = q.value.trim().toLowerCase();
        const treffer = liste.filter((x) => !s || `${x.frage} ${x.antwort} ${x.betreff}`.toLowerCase().includes(s));
        $('#bd-liste').innerHTML = treffer.length ? treffer.map(bdItem).join('') : empty(liste.length ? 'Nichts gefunden.' : 'Noch keine beantworteten Fragen.');
        reveal($('#bd-liste'));
      };
      q.addEventListener('input', render);
      render();
      const hash = decode(location.hash.slice(1));
      if (hash) document.getElementById(`f-${hash}`)?.scrollIntoView({ block: 'center' });
    },

    async massnahmen() {
      const ms = await load('massnahmen');
      const params = new URLSearchParams(location.search);
      const hashId = () => (location.hash.startsWith('#m-') ? decode(location.hash.slice(3)) : '');
      const state = { view: 'liste', q: '', phase: '', status: '', bereich: '', openId: hashId() };
      const bereiche = [...new Set(ms.map((m) => m.bereich).filter(Boolean))].sort();
      fillOptions($('#f-phase'), PHASES, tPhase);
      fillOptions($('#f-status'), STATUSES);
      fillOptions($('#f-bereich'), bereiche, (x) => x);
      if (bereiche.includes(params.get('bereich'))) state.bereich = $('#f-bereich').value = params.get('bereich');

      const filtered = () => {
        const q = state.q.trim().toLowerCase();
        return ms.filter((m) => (!state.phase || m.phase === state.phase)
          && (!state.status || m.status === state.status)
          && (!state.bereich || m.bereich === state.bereich)
          && (!q || [m.titel, m.bereich, m.beschreibung, m.verantwortlich].join(' ').toLowerCase().includes(q)));
      };

      function render() {
        const list = filtered();
        const root = $('#plan');
        $('#info').textContent = `${plural(list.length, 'Maßnahme', 'Maßnahmen')} ${t('von')} ${ms.length}`;
        if (!list.length) { root.innerHTML = empty('Keine Maßnahmen für diese Auswahl.'); return; }
        const openId = state.openId;
        state.openId = '';

        if (state.view === 'board') {
          root.innerHTML = `<div class="board">${STATUSES.map((s) => {
            const lane = list.filter((m) => m.status === s);
            return `<section class="lane" aria-label="${esc(t(s))}">
              <div class="lane-head"><span class="status" data-s="${STATUS_KEY[s]}">${esc(t(s))}</span><b>${lane.length}</b></div>
              ${lane.length ? lane.map(measureCard).join('') : `<div class="lane-empty">${esc(t('Keine Einträge'))}</div>`}
            </section>`;
          }).join('')}</div>`;
        } else if (state.view === 'phasen') {
          root.innerHTML = `<div class="phases">${PHASES.map((p) => {
            const group = list.filter((m) => m.phase === p);
            if (!group.length) return '';
            return `<section class="phase"><h3>${esc(tPhase(p))} <span>${plural(group.length, 'Maßnahme', 'Maßnahmen')}</span></h3>
              <div class="m-list">${group.map((m) => measureItem(m, m.id === openId)).join('')}</div></section>`;
          }).join('')}</div>`;
        } else {
          root.innerHTML = `<div class="m-list">${list.map((m) => measureItem(m, m.id === openId)).join('')}</div>`;
        }
        reveal(root);
      }

      $('#filters').addEventListener('submit', (e) => e.preventDefault());
      $('#filters .seg').addEventListener('click', (e) => {
        const v = e.target.closest('button')?.dataset.view;
        if (!v) return;
        state.view = v;
        e.currentTarget.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
        transition(render);
      });
      [['#f-phase', 'phase'], ['#f-status', 'status'], ['#f-bereich', 'bereich']].forEach(([sel, key]) =>
        $(sel).addEventListener('change', (e) => { state[key] = e.target.value; transition(render); }));
      $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
      function showHash() {
        const id = hashId();
        if (!id) return;
        state.view = 'liste';
        state.openId = id;
        $('#filters .seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === 'liste')));
        render();
        document.getElementById(`m-${id}`)?.scrollIntoView();
      }
      addEventListener('hashchange', showHash);
      render();
      showHash();
    },

    async gesetze() {
      const laws = (await load('gesetze')).map((g) => ({ ...g, zieltag: zday(g.zieltag) })).sort((a, b) => (a.zieltag || 999) - (b.zieltag || 999));
      const state = { q: '', stand: '' };
      fillOptions($('#f-stand'), LAW_STAGES);
      document.querySelector('.filters').addEventListener('submit', (e) => e.preventDefault());

      // Zeitachse: Pins an ihrem Zieltag, abwechselnd oben und unten gegen Überlappung.
      const map = $('#roadmap');
      const pins = laws.filter((g) => g.zieltag).map((g, i) =>
        `<a class="pin${i % 2 ? ' alt' : ''}" href="#g-${esc(g.id)}" style="left:${g.zieltag}%" title="${esc(g.titel)}"><b>${esc(g.kurz || g.titel.slice(0, 14))}</b>${esc(t('Tag'))} ${g.zieltag}</a>`).join('');
      map.innerHTML = `<div class="axis"><i data-p="${DAY}" style="--full:${(100 / Math.max(DAY, 1)) * 100}%"></i></div>
        <span class="today" style="left:${DAY}%" title="${esc(t('heute'))}"></span>${pins}
        <div class="ticks"><span>${esc(t('Tag'))} 1</span><span>${esc(t('Tag'))} 25</span><span>${esc(t('Tag'))} 50</span><span>${esc(t('Tag'))} 75</span><span>${esc(t('Tag'))} 100</span></div>`;
      requestAnimationFrame(() => requestAnimationFrame(() => { map.querySelector('.axis i').style.width = `${DAY}%`; }));

      function render() {
        const q = state.q.trim().toLowerCase();
        const list = laws.filter((g) => (!state.stand || g.stand === state.stand)
          && (!q || [g.titel, g.kurz, g.ziel, g.kernpunkte, g.bereich].join(' ').toLowerCase().includes(q)));
        const word = P.lang === 'en' ? (list.length === 1 ? 'bill' : 'bills') : (list.length === 1 ? 'Gesetz' : 'Gesetze');
        $('#info').textContent = `${list.length} ${word} ${t('von')} ${laws.length}`;
        $('#laws').innerHTML = list.length ? list.map(lawItem).join('') : empty('Noch keine Gesetzesvorhaben.');
        reveal($('#laws'));
      }
      $('#f-stand').addEventListener('change', (e) => { state.stand = e.target.value; render(); });
      $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
      render();
      if (location.hash.startsWith('#g-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    },

    async ministerium() {
      topicCounts(await load('massnahmen'));
    },

    async minister() {
      applySettings();
      const [events, fotos] = await Promise.all([load('termine'), loadFotos()]);
      const next = upcoming(events, 3);
      $('#events').innerHTML = next.length ? next.map(eventItem).join('') : empty('Keine anstehenden Termine.');
      fotoStrip($('#foto-strip'), fotos, ['rede-plenum', 'innenausschuss', 'buero-unterschrift', 'rede-polizei', 'buerger-tor', 'radiointerview', 'abschiebung', 'kanzleramt']);
      reveal();
    },

    async presse() {
      const [raw, fotos] = await Promise.all([load('meldungen'), loadFotos()]);
      const news = raw.slice().sort(byDateDesc);
      const used = new Set();
      const bild = new Map(news.map((n) => [n.id, fotoFor(n, fotos, used)]));
      const state = { q: '', kat: '' };
      fillOptions($('#f-kat'), NEWS_KIND);
      document.querySelector('.filters').addEventListener('submit', (e) => e.preventDefault());

      function render() {
        const q = state.q.trim().toLowerCase();
        const list = news.filter((n) => (!state.kat || (n.kategorie || 'Pressemitteilung') === state.kat)
          && (!q || `${n.titel} ${n.text}`.toLowerCase().includes(q)));
        $('#news').innerHTML = list.length ? list.map((n) => `
          <article class="press-item reveal${bild.get(n.id) ? ' has-img' : ''}" id="${esc(n.id)}">
            <div class="meta" style="flex-direction:column;align-items:flex-start"><time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time><span class="tag">${esc(t(n.kategorie || 'Pressemitteilung'))}</span></div>
            <div><h2>${esc(n.titel)}</h2><p>${esc(n.text)}</p></div>
            ${bild.get(n.id) ? `<a class="press-img" href="pressefotos.html#${esc(bild.get(n.id).id)}" title="${esc(t('Zum Pressefoto'))}">${fotoImg(bild.get(n.id), 's')}</a>` : ''}
          </article>`).join('') : empty('Keine Meldungen gefunden.');
        reveal();
      }
      fotoStrip($('#foto-strip'), fotos, ['portraet-studio', 'pressekonferenz', 'statement-reichstag', 'radiointerview', 'presse-mikrofone', 'rede-plenum']);
      $('#f-kat').addEventListener('change', (e) => { state.kat = e.target.value; render(); });
      $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
      render();
      if (location.hash) document.getElementById(decode(location.hash.slice(1)))?.scrollIntoView();
    },

    async termine() {
      const events = await load('termine');
      const now = B.today();
      const next = events.filter((e) => e.datum >= now).sort(byDateAsc);
      const past = events.filter((e) => e.datum < now).sort(byDateAsc).reverse();
      $('#upcoming').innerHTML = next.length ? next.map(eventItem).join('') : empty('Keine anstehenden Termine.');
      $('#past').innerHTML = past.length ? past.map(eventItem).join('') : empty('Noch keine vergangenen Termine.');
      reveal();
    },

    kontakt() {
      const form = $('#contact');
      const msg = $('#contact-msg');
      const preset = new URLSearchParams(location.search).get('betreff');
      if (preset && [...form.betreff.options].some((o) => o.value === preset)) form.betreff.value = preset;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        msg.className = 'msg';
        msg.textContent = t('Wird gesendet …');
        try {
          const data = Object.fromEntries(new FormData(form));
          delete data.ok;
          data.oeffentlichOk = form.oeffentlichOk ? form.oeffentlichOk.checked : false;
          const res = await fetch('/api/kontakt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || t('Senden fehlgeschlagen.'));
          form.reset();
          msg.className = 'msg ok';
          msg.textContent = t('Vielen Dank. Ihre Nachricht ist eingegangen.');
        } catch (err) {
          msg.className = 'msg err';
          msg.textContent = err instanceof TypeError ? t('Server nicht erreichbar. Bitte später erneut versuchen.') : err.message;
        } finally {
          btn.disabled = false;
        }
      });
    }
  };

  const page = pages[document.body.dataset.page];
  if (page) {
    Promise.resolve(page()).catch((err) => {
      console.error(err);
      const target = $('#plan') || $('#laws') || $('#news') || $('#current') || $('#upcoming') || $('#events');
      if (target) target.innerHTML = empty('Daten konnten nicht geladen werden.');
    });
  }
})();
