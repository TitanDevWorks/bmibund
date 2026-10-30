// Seitenlogik, gesteuert über <body data-page="...">.
(() => {
  const { esc, fmtDate, load, byDateDesc, measureCard, reveal, countUp, daysBar, transition, PHASES, STATUSES, STATUS_KEY } = window.BMIH;
  const $ = (s) => document.querySelector(s);
  const day = window.BMIH_DAY || 1;

  function newsList(items, limit) {
    const list = items.slice().sort(byDateDesc).slice(0, limit || items.length);
    if (!list.length) return '<div class="empty">Noch keine Meldungen.</div>';
    return list.map((n) => `
      <article class="reveal">
        <time datetime="${esc(n.datum)}">${fmtDate(n.datum)}</time>
        <div><h3>${esc(n.titel)}</h3><p>${esc(n.text)}</p></div>
      </article>`).join('');
  }

  const pages = {
    async start() {
      const [ms, news] = await Promise.all([load('massnahmen'), load('meldungen')]);

      document.querySelectorAll('[data-count]').forEach((el) =>
        countUp(el, ms.filter((m) => m.status === el.dataset.count).length));
      countUp($('#ring-day'), day);
      requestAnimationFrame(() => { $('#ring-bar').style.strokeDashoffset = String(326.7 * (1 - day / 100)); });

      daysBar($('#days-bar'), day);

      const current = ms.filter((m) => m.status === 'In Arbeit' || m.status === 'Im Kabinett').slice(0, 6);
      $('#current').innerHTML = current.length
        ? current.map(measureCard).join('')
        : '<div class="empty">Aktuell ist keine Maßnahme in Arbeit.</div>';

      const sorted = news.slice().sort(byDateDesc);
      const items = sorted.map((n) => `<span class="ticker-item"><time>${fmtDate(n.datum)}</time>${esc(n.titel)}</span>`).join('');
      $('#ticker').innerHTML = items + items; // doppelt für nahtlose Schleife
      $('#news').innerHTML = newsList(news, 3);
      reveal();
    },

    async massnahmen() {
      const ms = await load('massnahmen');
      const state = { view: 'board', phase: '', q: '' };
      daysBar($('#days-bar'), day);

      function filtered() {
        const q = state.q.trim().toLowerCase();
        return ms.filter((m) => (!state.phase || m.phase === state.phase)
          && (!q || [m.titel, m.bereich, m.beschreibung].join(' ').toLowerCase().includes(q)));
      }

      function render() {
        const list = filtered();
        const root = $('#plan');
        if (!list.length) { root.innerHTML = '<div class="empty">Keine Maßnahmen für diese Auswahl.</div>'; return; }

        if (state.view === 'board') {
          root.innerHTML = `<div class="board">${STATUSES.map((s) => {
            const lane = list.filter((m) => m.status === s);
            return `<section class="lane" aria-label="${esc(s)}">
              <div class="lane-head"><span class="dot ${STATUS_KEY[s]}"></span>${esc(s)}<b>${lane.length}</b></div>
              ${lane.length ? lane.map(measureCard).join('') : '<div class="lane-empty">Keine Einträge</div>'}
            </section>`;
          }).join('')}</div>`;
        } else {
          root.innerHTML = `<div class="timeline">${PHASES.map((p) => {
            const group = list.filter((m) => m.phase === p);
            if (!group.length) return '';
            return `<div><div class="phase-head"><h3>${esc(p)}</h3><span>${group.length} Maßnahme${group.length === 1 ? '' : 'n'}</span></div>
              <div class="grid-cards">${group.map(measureCard).join('')}</div></div>`;
          }).join('')}</div>`;
        }
      }

      function press(group, attr, value) {
        group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));
      }

      document.querySelector('[aria-label="Ansicht"]').addEventListener('click', (e) => {
        const v = e.target.closest('button')?.dataset.view;
        if (!v) return;
        state.view = v;
        press(e.currentTarget, 'view', v);
        transition(render);
      });
      $('#phase-filter').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        state.phase = btn.dataset.phase;
        press(e.currentTarget, 'phase', state.phase);
        transition(render);
      });
      $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
      render();
    },

    async ministerium() {
      const ms = await load('massnahmen');
      document.querySelectorAll('#bento .tile').forEach((tile) => {
        const n = ms.filter((m) => m.bereich === tile.dataset.bereich).length;
        if (n) tile.querySelector('.count').textContent = `${n} Maßnahme${n === 1 ? '' : 'n'}`;
      });
    },

    async presse() {
      $('#news').innerHTML = newsList(await load('meldungen'));
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
          msg.textContent = 'Danke! Ihre Nachricht ist eingegangen.';
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
      const target = $('#plan') || $('#news') || $('#current');
      if (target) target.innerHTML = '<div class="empty">Daten konnten nicht geladen werden.</div>';
    });
  }
})();
