// Seitenlogik, gesteuert über <body data-page="...">.
(() => {
  const B = window.BMIH;
  const { esc, fmtDate, load, byDateDesc, byDateAsc, progressOf, measureItem, measureCard, newsTeaser, eventItem, lawItem, lawSteps, dueLabel, zday, reveal, countUp, transition, PHASES, STATUSES, STATUS_KEY, NEWS_KIND, LAW_STAGES, DAY, t, tPhase, P } = B;
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

  const pages = {
    async start() {
      applySettings();
      const [ms, news, events, laws] = await Promise.all([load('massnahmen'), load('meldungen'), load('termine'), load('gesetze').catch(() => [])]);

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

      $('#news').innerHTML = news.length ? news.slice().sort(byDateDesc).slice(0, 3).map(newsTeaser).join('') : empty('Noch keine Meldungen.');

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
          <div class="meta">${g.kurz ? `<span class="tag">${esc(g.kurz)}</span>` : ''}${g.zieltag ? `<span>${esc(t('Zieltag'))} ${g.zieltag} · ${esc(dueLabel(g.zieltag, g.stand))}</span>` : ''}</div>
          <h3>${esc(g.titel)}</h3>
          ${lawSteps(g.stand)}
          <span class="status" data-s="${g.stand === 'Verkündet' ? 'fertig' : 'arbeit'}">${esc(t(g.stand))}</span>
        </a>`).join('') : empty('Noch keine Gesetzesvorhaben.');

      startCountdown(upcoming(events, 1)[0]);
      reveal();
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
      const next = upcoming(await load('termine'), 3);
      $('#events').innerHTML = next.length ? next.map(eventItem).join('') : empty('Keine anstehenden Termine.');
      reveal();
    },

    async presse() {
      const news = (await load('meldungen')).slice().sort(byDateDesc);
      const state = { q: '', kat: '' };
      fillOptions($('#f-kat'), NEWS_KIND);
      document.querySelector('.filters').addEventListener('submit', (e) => e.preventDefault());

      function render() {
        const q = state.q.trim().toLowerCase();
        const list = news.filter((n) => (!state.kat || (n.kategorie || 'Pressemitteilung') === state.kat)
          && (!q || `${n.titel} ${n.text}`.toLowerCase().includes(q)));
        $('#news').innerHTML = list.length ? list.map((n) => `
          <article class="press-item reveal" id="${esc(n.id)}">
            <div class="meta" style="flex-direction:column;align-items:flex-start"><time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time><span class="tag">${esc(t(n.kategorie || 'Pressemitteilung'))}</span></div>
            <div><h2>${esc(n.titel)}</h2><p>${esc(n.text)}</p></div>
          </article>`).join('') : empty('Keine Meldungen gefunden.');
        reveal();
      }
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
