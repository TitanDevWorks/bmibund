// Seitenlogik, gesteuert über <body data-page="...">.
(() => {
  const B = window.BMIH;
  const { esc, fmtDate, load, byDateDesc, byDateAsc, progressOf, measureItem, measureCard, newsTeaser, eventItem, reveal, countUp, transition, PHASES, STATUSES, STATUS_KEY, NEWS_KIND, DAY } = B;
  const $ = (s) => document.querySelector(s);
  const empty = (text) => `<div class="empty">${esc(text)}</div>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const fillOptions = (select, values) => {
    select.insertAdjacentHTML('beforeend', values.map((v) => `<option>${esc(v)}</option>`).join(''));
  };

  function upcoming(events, limit) {
    const t = B.today();
    return events.filter((e) => e.datum >= t).sort(byDateAsc).slice(0, limit);
  }

  async function applySettings() {
    const s = await load('settings').catch(() => null);
    if (!s) return;
    const set = (sel, v) => { const el = $(sel); if (el && v) el.textContent = v; };
    set('#hero-title', s.heroTitel);
    set('#hero-text', s.heroText);
    set('#quote', s.ministerZitat);
  }

  function topicCounts(ms) {
    document.querySelectorAll('#topics .topic[data-bereich]').forEach((tile) => {
      const n = ms.filter((m) => m.bereich === tile.dataset.bereich).length;
      tile.querySelector('.count').textContent = n ? `${plural(n, 'Maßnahme', 'Maßnahmen')} im Plan` : '';
    });
  }

  const pages = {
    async start() {
      applySettings();
      const [ms, news, events] = await Promise.all([load('massnahmen'), load('meldungen'), load('termine')]);

      $('#sb-date').textContent = `Stand ${fmtDate(B.today())}`;
      countUp($('#day-num'), DAY);
      const dayBar = $('#day-bar');
      dayBar.dataset.p = DAY;
      dayBar.style.setProperty('--full', `${(100 / Math.max(DAY, 1)) * 100}%`);
      document.querySelectorAll('[data-count]').forEach((el) =>
        countUp(el, ms.filter((m) => m.status === el.dataset.count).length));
      const total = ms.length ? Math.round(ms.reduce((a, m) => a + progressOf(m), 0) / ms.length) : 0;
      $('#total-p').textContent = `${total} %`;
      $('#total-bar').dataset.p = total;

      $('#news').innerHTML = news.length ? news.slice().sort(byDateDesc).slice(0, 3).map(newsTeaser).join('') : empty('Noch keine Meldungen.');

      const current = ms.filter((m) => m.status === 'In Arbeit' || m.status === 'Im Kabinett')
        .sort((a, b) => progressOf(b) - progressOf(a)).slice(0, 5);
      $('#current').innerHTML = current.length ? current.map((m) => measureItem(m)).join('') : empty('Aktuell ist keine Maßnahme in Bearbeitung.');

      const next = upcoming(events, 3);
      $('#events').innerHTML = next.length ? next.map(eventItem).join('') : empty('Keine anstehenden Termine.');
      const n = upcoming(events).length;
      $('#events-count').textContent = n ? `${plural(n, 'anstehender Termin', 'anstehende Termine')}` : '';
      topicCounts(ms);
      reveal();
    },

    async massnahmen() {
      const ms = await load('massnahmen');
      const params = new URLSearchParams(location.search);
      const hashId = () => (location.hash.startsWith('#m-') ? decodeURIComponent(location.hash.slice(3)) : '');
      const state = { view: 'liste', q: '', phase: '', status: '', bereich: '', openId: hashId() };
      const bereiche = [...new Set(ms.map((m) => m.bereich).filter(Boolean))].sort();
      fillOptions($('#f-phase'), PHASES);
      fillOptions($('#f-status'), STATUSES);
      fillOptions($('#f-bereich'), bereiche);
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
        $('#info').textContent = `${plural(list.length, 'Maßnahme', 'Maßnahmen')} von ${ms.length}`;
        if (!list.length) { root.innerHTML = empty('Keine Maßnahmen für diese Auswahl.'); return; }
        const openId = state.openId;
        state.openId = '';

        if (state.view === 'board') {
          root.innerHTML = `<div class="board">${STATUSES.map((s) => {
            const lane = list.filter((m) => m.status === s);
            return `<section class="lane" aria-label="${esc(s)}">
              <div class="lane-head"><span class="status" data-s="${STATUS_KEY[s]}">${esc(s)}</span><b>${lane.length}</b></div>
              ${lane.length ? lane.map(measureCard).join('') : '<div class="lane-empty">Keine Einträge</div>'}
            </section>`;
          }).join('')}</div>`;
        } else if (state.view === 'phasen') {
          root.innerHTML = `<div class="phases">${PHASES.map((p) => {
            const group = list.filter((m) => m.phase === p);
            if (!group.length) return '';
            return `<section class="phase"><h3>${esc(p)} <span>${plural(group.length, 'Maßnahme', 'Maßnahmen')}</span></h3>
              <div class="m-list">${group.map((m) => measureItem(m, m.id === openId)).join('')}</div></section>`;
          }).join('')}</div>`;
        } else {
          root.innerHTML = `<div class="m-list">${list.map((m) => measureItem(m, m.id === openId)).join('')}</div>`;
        }
        reveal(root);
      }

      $('#filters').addEventListener('submit', (e) => e.preventDefault());
      $('[aria-label="Ansicht"]').addEventListener('click', (e) => {
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
        $('[aria-label="Ansicht"]').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === 'liste')));
        render();
        document.getElementById(`m-${id}`)?.scrollIntoView();
      }
      addEventListener('hashchange', showHash);
      render();
      showHash();
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
            <div class="meta" style="flex-direction:column;align-items:flex-start"><time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time><span class="tag">${esc(n.kategorie || 'Pressemitteilung')}</span></div>
            <div><h2>${esc(n.titel)}</h2><p>${esc(n.text)}</p></div>
          </article>`).join('') : empty('Keine Meldungen gefunden.');
        reveal();
      }
      $('#f-kat').addEventListener('change', (e) => { state.kat = e.target.value; render(); });
      $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
      render();
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    },

    async termine() {
      const events = await load('termine');
      const t = B.today();
      const next = events.filter((e) => e.datum >= t).sort(byDateAsc);
      const past = events.filter((e) => e.datum < t).sort(byDateAsc).reverse();
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
        msg.textContent = 'Wird gesendet …';
        try {
          const data = Object.fromEntries(new FormData(form));
          delete data.ok;
          const res = await fetch('/api/kontakt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || 'Senden fehlgeschlagen.');
          form.reset();
          msg.className = 'msg ok';
          msg.textContent = 'Vielen Dank. Ihre Nachricht ist eingegangen.';
        } catch (err) {
          msg.className = 'msg err';
          msg.textContent = err instanceof TypeError ? 'Server nicht erreichbar. Bitte später erneut versuchen.' : err.message;
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
      const target = $('#plan') || $('#news') || $('#current') || $('#upcoming') || $('#events');
      if (target) target.innerHTML = empty('Daten konnten nicht geladen werden.');
    });
  }
})();
