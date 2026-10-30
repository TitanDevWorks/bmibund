(() => {
  const PHASES = ['Tag 1–10', 'Tag 11–50', 'Tag 51–100'];
  const STATUSES = ['Offen', 'In Arbeit', 'Im Kabinett', 'Abgeschlossen'];
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  let token = sessionStorage.getItem('bmih-token') || '';

  async function api(method, path, body) {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Fehler ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  function flash(el, text, ok = true) {
    el.textContent = text;
    el.className = `msg ${ok ? 'ok' : 'err'}`;
    setTimeout(() => { el.textContent = ''; }, 3000);
  }

  const options = (values, selected) => values
    .map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');

  async function renderList() {
    const items = await api('GET', 'massnahmen');
    $('#list').innerHTML = items.map((m) => `
      <div class="row" data-id="${esc(m.id)}">
        <strong>${esc(m.titel)}</strong>
        <select data-field="phase">${options(PHASES, m.phase)}</select>
        <select data-field="status">${options(STATUSES, m.status)}</select>
        <button class="btn btn-danger" data-action="delete" type="button">Löschen</button>
      </div>`).join('');
  }

  async function enter() {
    // Verify the token against a protected endpoint before showing the editor.
    await api('GET', 'auth');
    $('#login-panel').hidden = true;
    $('#app').hidden = false;
    await renderList();
  }

  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    token = $('#token').value.trim();
    try {
      await enter();
      sessionStorage.setItem('bmih-token', token);
    } catch (err) {
      flash($('#login-msg'), err.message, false);
    }
  });

  $('#list').addEventListener('change', async (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const id = e.target.closest('.row').dataset.id;
    try {
      await api('PUT', `massnahmen/${encodeURIComponent(id)}`, { [field]: e.target.value });
      flash($('#list-msg'), 'Gespeichert.');
    } catch (err) {
      flash($('#list-msg'), err.message, false);
    }
  });

  $('#list').addEventListener('click', async (e) => {
    if (e.target.dataset.action !== 'delete') return;
    const row = e.target.closest('.row');
    if (!confirm(`„${row.querySelector('strong').textContent}“ wirklich löschen?`)) return;
    try {
      await api('DELETE', `massnahmen/${encodeURIComponent(row.dataset.id)}`);
      await renderList();
      flash($('#list-msg'), 'Gelöscht.');
    } catch (err) {
      flash($('#list-msg'), err.message, false);
    }
  });

  $('#new-measure').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await api('POST', 'massnahmen', data);
      e.target.reset();
      await renderList();
      flash($('#list-msg'), 'Maßnahme angelegt.');
    } catch (err) {
      flash($('#list-msg'), err.message, false);
    }
  });

  $('#new-news').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await api('POST', 'meldungen', data);
      e.target.reset();
      flash($('#news-msg'), 'Pressemitteilung veröffentlicht.');
    } catch (err) {
      flash($('#news-msg'), err.message, false);
    }
  });

  document.querySelector('#new-measure [name=phase]').innerHTML = options(PHASES);
  document.querySelector('#new-measure [name=status]').innerHTML = options(STATUSES);
  document.querySelector('#new-news [name=datum]').valueAsDate = new Date();

  if (token) enter().catch(() => sessionStorage.removeItem('bmih-token'));
})();
