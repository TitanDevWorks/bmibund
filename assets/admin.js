// Verwaltung: Anmeldung per Benutzername/Passwort, Sitzung als HttpOnly-Cookie.
(() => {
  const { esc, fmtDate, PHASES, STATUSES, byDateDesc } = window.BMIH;
  const $ = (s) => document.querySelector(s);

  async function api(method, path, body) {
    const res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) { showLogin(); throw new Error('Sitzung abgelaufen. Bitte neu anmelden.'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Fehler ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  let flashTimer;
  function flash(text, ok = true) {
    const el = $('#msg');
    el.textContent = text;
    el.className = `msg ${ok ? 'ok' : 'err'}`;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.textContent = ''; }, 3500);
  }
  const run = (fn) => fn().catch((err) => flash(err.message, false));

  const options = (values, selected) => values
    .map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');

  function showLogin() {
    $('#app').hidden = true;
    $('#login-view').hidden = false;
  }

  async function renderMeasures() {
    const items = await api('GET', 'massnahmen');
    $('#m-list').innerHTML = items.length ? items.map((m) => `
      <div class="row" data-id="${esc(m.id)}">
        <strong>${esc(m.titel)}</strong>
        <select data-field="phase" aria-label="Phase">${options(PHASES, m.phase)}</select>
        <select data-field="status" aria-label="Status">${options(STATUSES, m.status)}</select>
        <button class="btn btn-sm btn-danger" data-del="massnahmen" type="button">Löschen</button>
      </div>`).join('') : '<div class="empty">Keine Maßnahmen.</div>';
  }

  async function renderNews() {
    const items = (await api('GET', 'meldungen')).sort(byDateDesc);
    $('#n-list').innerHTML = items.length ? items.map((n) => `
      <div class="row" data-id="${esc(n.id)}" style="grid-template-columns:minmax(0,1fr) auto auto">
        <strong>${esc(n.titel)}</strong>
        <span class="mono muted">${fmtDate(n.datum)}</span>
        <button class="btn btn-sm btn-danger" data-del="meldungen" type="button">Löschen</button>
      </div>`).join('') : '<div class="empty">Keine Meldungen.</div>';
  }

  async function renderInbox() {
    const items = (await api('GET', 'kontakt')).sort((a, b) => String(b.eingang).localeCompare(String(a.eingang)));
    $('#inbox-count').textContent = items.length || '';
    $('#inbox').innerHTML = items.length ? items.map((k) => `
      <article class="mail row" data-id="${esc(k.id)}" style="grid-template-columns:minmax(0,1fr) auto">
        <div>
          <div class="mail-head"><strong>${esc(k.betreff)} · ${esc(k.name)}</strong><span>${esc(new Date(k.eingang).toLocaleString('de-DE'))}</span></div>
          <a href="mailto:${encodeURIComponent(k.email).replace(/%40/g, '@')}">${esc(k.email)}</a>
          <p>${esc(k.nachricht)}</p>
        </div>
        <button class="btn btn-sm btn-danger" data-del="kontakt" type="button">Erledigt</button>
      </article>`).join('') : '<div class="empty">Keine neuen Nachrichten.</div>';
  }

  async function enter(session) {
    $('#who').textContent = session.user;
    $('#login-view').hidden = true;
    $('#app').hidden = false;
    await Promise.all([renderMeasures(), renderNews(), renderInbox()]);
  }

  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#login-msg');
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const session = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Anmeldung fehlgeschlagen');
        return body;
      });
      e.target.reset();
      msg.textContent = '';
      await enter(session);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'msg err';
    }
  });

  $('#logout').addEventListener('click', () => run(async () => {
    await api('POST', 'logout');
    showLogin();
  }));

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('button')?.dataset.tab;
    if (!tab) return;
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    document.querySelectorAll('.tab').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  });

  $('#m-list').addEventListener('change', (e) => run(async () => {
    const field = e.target.dataset.field;
    if (!field) return;
    const id = e.target.closest('.row').dataset.id;
    await api('PUT', `massnahmen/${encodeURIComponent(id)}`, { [field]: e.target.value });
    flash('Gespeichert.');
  }));

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const row = btn.closest('[data-id]');
    const kind = btn.dataset.del;
    if (kind !== 'kontakt' && !confirm(`„${row.querySelector('strong').textContent}“ wirklich löschen?`)) return;
    run(async () => {
      await api('DELETE', `${kind}/${encodeURIComponent(row.dataset.id)}`);
      if (kind === 'massnahmen') await renderMeasures();
      if (kind === 'meldungen') await renderNews();
      if (kind === 'kontakt') await renderInbox();
      flash(kind === 'kontakt' ? 'Nachricht gelöscht.' : 'Gelöscht.');
    });
  });

  $('#m-new').addEventListener('submit', (e) => {
    e.preventDefault();
    run(async () => {
      await api('POST', 'massnahmen', Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      await renderMeasures();
      flash('Maßnahme angelegt.');
    });
  });

  $('#n-new').addEventListener('submit', (e) => {
    e.preventDefault();
    run(async () => {
      await api('POST', 'meldungen', Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      $('#n-new [name=datum]').valueAsDate = new Date();
      await renderNews();
      flash('Pressemitteilung veröffentlicht.');
    });
  });

  $('#m-new [name=phase]').innerHTML = options(PHASES);
  $('#m-new [name=status]').innerHTML = options(STATUSES);
  $('#n-new [name=datum]').valueAsDate = new Date();

  // Bestehende Sitzung prüfen
  fetch('/api/session', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(enter)
    .catch(showLogin);
})();
