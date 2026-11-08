// Verwaltung: Anmeldung per Benutzername/Passwort, Sitzung als HttpOnly-Cookie.
// Alle Inhalte aus der API werden vor dem Einfügen mit esc() maskiert.
(() => {
  const B = window.BMIH;
  const { esc, fmtDate, PHASES, STATUSES, STATUS_KEY, NEWS_KIND, EVENT_KIND, LAW_STAGES, dueLabel, byDateDesc, byDateAsc, progressOf, statusBadge, bar, fillBars } = B;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const data = { massnahmen: [], meldungen: [], gesetze: [], termine: [], kontakt: [], protokoll: [], settings: {} };
  const filters = {};
  let session = null;
  let tab = 'dashboard';

  // --- API -------------------------------------------------------------------

  async function api(method, path, body) {
    const res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      showLogin('Sitzung abgelaufen. Bitte neu anmelden.');
      throw new Error('Sitzung abgelaufen.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Fehler ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  function toast(text, ok = true) {
    const el = document.createElement('div');
    el.className = `toast${ok ? '' : ' err'}`;
    el.textContent = text;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 3500);
  }
  const run = (fn) => Promise.resolve().then(fn).catch((err) => { if (err.message !== 'Sitzung abgelaufen.') toast(err.message, false); });

  const options = (values, selected) => values.map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const dateTime = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); };
  const emptyRow = (cols, text) => `<tr class="empty-row"><td colspan="${cols}">${esc(text)}</td></tr>`;
  const match = (obj, q, keys) => !q || keys.map((k) => obj[k] || '').join(' ').toLowerCase().includes(q.toLowerCase());
  const editBtns = (col) => `<button class="btn btn-sm" type="button" data-edit="${col}">Bearbeiten</button><button class="btn btn-sm btn-danger" type="button" data-del="${col}">Löschen</button>`;

  // --- Formularfelder je Bereich ---------------------------------------------

  const FIELDS = {
    massnahmen: {
      label: 'Maßnahme',
      fields: [
        { k: 'titel', l: 'Titel', req: true, max: 200, full: true },
        { k: 'phase', l: 'Phase', t: 'select', opts: PHASES, req: true },
        { k: 'status', l: 'Status', t: 'select', opts: STATUSES, req: true },
        { k: 'fortschritt', l: 'Fortschritt', t: 'range', full: true },
        { k: 'bereich', l: 'Bereich', max: 80, list: 'bereiche' },
        { k: 'verantwortlich', l: 'Zuständig', max: 120, ph: 'z. B. Abteilung M' },
        { k: 'frist', l: 'Frist', t: 'date' },
        { k: 'grundlage', l: 'Grundlage', max: 120, ph: 'Koalitionsvertrag Art. …' },
        { k: 'beschreibung', l: 'Beschreibung', t: 'textarea', max: 1000, full: true }
      ],
      blank: () => ({ phase: PHASES[0], status: 'Offen', fortschritt: 0 })
    },
    meldungen: {
      label: 'Meldung',
      fields: [
        { k: 'titel', l: 'Titel', req: true, max: 200, full: true },
        { k: 'datum', l: 'Datum', t: 'date', req: true },
        { k: 'kategorie', l: 'Art', t: 'select', opts: NEWS_KIND },
        { k: 'status', l: 'Status', t: 'select', opts: ['Veröffentlicht', 'Entwurf'] },
        { k: 'teaser', l: 'Kurztext für Startseite und Vorschau', t: 'textarea', max: 300, rows: 2, full: true, ph: 'Ein bis zwei Sätze. Leer = Anfang des Textes.' },
        { k: 'text', l: 'Text', t: 'textarea', req: true, max: 6000, rows: 10, full: true },
        { k: 'oben', l: 'Oben anheften (erscheint auf der Startseite zuerst)', t: 'check', full: true },
        { k: 'bild', l: 'Bild', t: 'hidden' }
      ],
      blank: () => ({ datum: B.today(), kategorie: 'Pressemitteilung', status: 'Entwurf', bild: '' })
    },
    gesetze: {
      label: 'Gesetz',
      fields: [
        { k: 'titel', l: 'Titel des Gesetzes', req: true, max: 200, full: true },
        { k: 'kurz', l: 'Kurzbezeichnung', max: 40, ph: 'z. B. RückfG' },
        { k: 'stand', l: 'Stand im Verfahren', t: 'select', opts: LAW_STAGES, req: true },
        { k: 'zieltag', l: 'Zieltag (1–100)', t: 'number', min: 1, maxv: 100 },
        { k: 'bereich', l: 'Bereich', max: 80, list: 'bereiche' },
        { k: 'ziel', l: 'Ziel', t: 'textarea', max: 600, rows: 3, full: true },
        { k: 'kernpunkte', l: 'Kernpunkte (eine Zeile pro Punkt)', t: 'textarea', max: 3000, rows: 5, full: true },
        { k: 'naechsterSchritt', l: 'Nächster Schritt', max: 200, full: true },
        { k: 'grundlage', l: 'Grundlage', max: 120, ph: 'Koalitionsvertrag Art. …', full: true }
      ],
      blank: () => ({ stand: 'In Vorbereitung' })
    },
    termine: {
      label: 'Termin',
      fields: [
        { k: 'titel', l: 'Titel', req: true, max: 200, full: true },
        { k: 'datum', l: 'Datum', t: 'date', req: true },
        { k: 'zeit', l: 'Uhrzeit', t: 'time' },
        { k: 'art', l: 'Art', t: 'select', opts: EVENT_KIND },
        { k: 'ort', l: 'Ort', max: 120 },
        { k: 'beschreibung', l: 'Beschreibung', t: 'textarea', max: 1000, full: true }
      ],
      blank: () => ({ datum: B.today(), art: 'Termin' })
    }
  };

  function fieldHtml(f, v) {
    const val = v ?? '';
    const attrs = `name="${f.k}"${f.req ? ' required' : ''}${f.max ? ` maxlength="${f.max}"` : ''}${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}${f.min ? ` min="${f.min}" max="${f.maxv}"` : ''}`;
    let input;
    if (f.t === 'hidden') return `<input type="hidden" name="${f.k}" value="${esc(val)}">`;
    if (f.t === 'check') return `<label class="check${f.full ? ' full' : ''}"><input type="checkbox" name="${f.k}"${val ? ' checked' : ''}> ${esc(f.l)}</label>`;
    if (f.t === 'select') input = `<select ${attrs}>${options(f.opts, val)}</select>`;
    else if (f.t === 'textarea') input = `<textarea ${attrs} rows="${f.rows || 4}">${esc(val)}</textarea>`;
    else if (f.t === 'range') input = `<span class="range"><input type="range" ${attrs} min="0" max="100" step="5" value="${Number(val) || 0}"><output>${Number(val) || 0} %</output></span>`;
    else input = `<input type="${f.t || 'text'}" ${attrs} value="${esc(val)}"${f.list ? ` list="${f.list}"` : ''}>`;
    return `<label class="field${f.full ? ' full' : ''}">${esc(f.l)}${f.req ? ' *' : ''} ${input}</label>`;
  }

  let editing = null; // { col, id }
  function openEditor(col, item) {
    const cfg = FIELDS[col];
    editing = { col, id: item ? item.id : null };
    const values = item || cfg.blank();
    $('#editor-title').textContent = `${cfg.label} ${item ? 'bearbeiten' : 'anlegen'}`;
    const bereiche = [...new Set(data.massnahmen.map((m) => m.bereich).filter(Boolean))];
    const felder = cfg.fields.map((f) => fieldHtml(f, values[f.k])).join('')
      + `<datalist id="bereiche">${bereiche.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>`;
    const breit = col === 'meldungen';
    $('#editor').classList.toggle('breit', breit);
    $('#editor-fields').classList.toggle('ohne-rand', breit);
    $('#editor-fields').innerHTML = breit
      ? `<div class="ed-split"><div class="form">${felder}</div><aside class="ed-vorschau" id="ed-vorschau" aria-label="Vorschau"></aside></div>`
      : felder;
    document.dispatchEvent(new CustomEvent('admin:editor', { detail: { col, item: values } }));
    const range = $('#editor-fields input[type=range]');
    if (range) range.addEventListener('input', () => { range.nextElementSibling.textContent = `${range.value} %`; });
    $('#editor').showModal();
    $('#editor-fields [name]').focus();
  }

  $('#editor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity() || !editing) return;
    const { col, id } = editing;
    const body = {};
    FIELDS[col].fields.forEach((f) => {
      const el = form.elements[f.k];
      if (f.t === 'check') { body[f.k] = el.checked; return; }
      const v = el.value;
      body[f.k] = f.t === 'range' || (f.t === 'number' && v !== '') ? Number(v) : v.trim();
    });
    if (!id) Object.keys(body).forEach((k) => { if (body[k] === '') delete body[k]; });
    const save = form.querySelector('button[type=submit]');
    save.disabled = true;
    run(async () => {
      await api(id ? 'PUT' : 'POST', id ? `${col}/${encodeURIComponent(id)}` : col, body);
      $('#editor').close();
      toast(`${FIELDS[col].label} ${id ? 'gespeichert' : 'angelegt'}.`);
      await refresh(col);
    }).finally(() => { save.disabled = false; });
  });
  $$('#editor [data-close]').forEach((b) => b.addEventListener('click', () => $('#editor').close()));

  // --- Laden -----------------------------------------------------------------

  async function refresh(...cols) {
    const all = cols.length ? cols : ['massnahmen', 'meldungen', 'gesetze', 'termine', 'kontakt', 'protokoll', 'settings'];
    await Promise.all(all.map(async (c) => {
      if (c === 'protokoll') data.protokoll = await api('GET', 'audit');
      else if (c === 'settings') data.settings = await api('GET', 'settings');
      else data[c] = await api('GET', `${c}?admin=1`);
    }));
    if (!all.includes('protokoll')) data.protokoll = await api('GET', 'audit');
    renderAll();
  }

  function renderAll() {
    const unread = data.kontakt.filter((k) => !k.gelesen).length;
    $('#badge-inbox').textContent = unread;
    $('#badge-inbox').hidden = !unread;
    render.dashboard();
    render.massnahmen();
    render.meldungen();
    render.gesetze();
    render.termine();
    render.kontakt();
    render.protokoll();
    fillBars($('#app'));
    document.dispatchEvent(new CustomEvent('admin:render'));
  }

  // --- Darstellung -------------------------------------------------------------

  const render = {
    dashboard() {
      const ms = data.massnahmen;
      const avg = ms.length ? Math.round(ms.reduce((a, m) => a + progressOf(m), 0) / ms.length) : 0;
      const t = B.today();
      const kpis = [
        ['Maßnahmen', ms.length, 'var(--brand)', 'liste'],
        ['In Arbeit', ms.filter((m) => m.status === 'In Arbeit').length, 'var(--s-arbeit)', 'vorgang'],
        ['Abgeschlossen', ms.filter((m) => m.status === 'Abgeschlossen').length, 'var(--s-fertig)', 'haken'],
        ['Umsetzung', `${avg} %`, 'var(--gold)', 'radar'],
        ['Ungelesen', data.kontakt.filter((k) => !k.gelesen).length, 'var(--red)', 'brief'],
        ['Gesetze im Verfahren', data.gesetze.filter((g) => !B.LAW_DONE.includes(g.stand)).length, 'var(--s-kabinett)', 'paragraf']
      ];
      $('#dash-kpis').innerHTML = kpis.map(([l, v, c, ik]) => `<div class="kpi-card" style="--c:${c}"><i data-ikon="${ik}" class="kpi-ik"></i><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
      $('#dash-day').textContent = `Amtstag ${B.DAY} · ${fmtDate(t)}`;
      cockpit(t);

      $('#dash-phases').innerHTML = PHASES.map((p) => {
        const g = ms.filter((m) => m.phase === p);
        const v = g.length ? Math.round(g.reduce((a, m) => a + progressOf(m), 0) / g.length) : 0;
        return `<div class="phase-row"><span>${esc(p)}</span>${bar(v, false)}<b>${v} %</b></div>`;
      }).join('');

      const inbox = data.kontakt.filter((k) => !k.gelesen).sort((a, b) => String(b.eingang).localeCompare(String(a.eingang))).slice(0, 4);
      $('#dash-inbox').innerHTML = inbox.length ? `<div class="mini">${inbox.map((k) => `<div><b>${esc(k.betreff)}</b> · ${esc(k.name)}<small>${esc(dateTime(k.eingang))}</small></div>`).join('')}</div>` : '<p class="muted">Keine ungelesenen Nachrichten.</p>';

      const ev = data.termine.filter((e) => e.datum >= t).sort(byDateAsc).slice(0, 4);
      $('#dash-events').innerHTML = ev.length ? `<div class="mini">${ev.map((e) => `<div><b>${esc(e.titel)}</b><small>${fmtDate(e.datum)}${e.zeit ? `, ${esc(e.zeit)} Uhr` : ''} · ${esc(e.art || 'Termin')}</small></div>`).join('')}</div>` : '<p class="muted">Keine anstehenden Termine.</p>';

      const au = data.protokoll.slice(0, 5);
      $('#dash-audit').innerHTML = au.length ? `<div class="mini">${au.map((a) => `<div><b>${esc(a.aktion)}</b> · ${esc(a.bereich)}${a.objekt ? `: ${esc(a.objekt)}` : ''}<small>${esc(dateTime(a.zeit))}</small></div>`).join('')}</div>` : '<p class="muted">Noch keine Einträge.</p>';
    },

    massnahmen() {
      const f = filters.massnahmen || {};
      const list = data.massnahmen.filter((m) => (!f.phase || m.phase === f.phase) && (!f.status || m.status === f.status)
        && match(m, f.q, ['titel', 'bereich', 'beschreibung', 'verantwortlich']));
      $('#list-massnahmen').innerHTML = list.length ? list.map((m) => `
        <tr data-id="${esc(m.id)}">
          <td class="title">${esc(m.titel)}<small>${esc([m.bereich, m.verantwortlich].filter(Boolean).join(' · '))}</small></td>
          <td class="nowrap">${esc(m.phase)}</td>
          <td><select class="inline" data-field="status" aria-label="Status">${options(STATUSES, m.status)}</select></td>
          <td>${bar(progressOf(m))}</td>
          <td class="nowrap">${m.frist ? fmtDate(m.frist) : '–'}</td>
          <td class="actions">${editBtns('massnahmen')}</td>
        </tr>`).join('') : emptyRow(6, 'Keine Maßnahmen gefunden.');
    },

    meldungen() {
      const f = filters.meldungen || {};
      const list = data.meldungen.slice().sort(byDateDesc).filter((n) => (!f.status || (n.status || 'Veröffentlicht') === f.status)
        && (!f.kategorie || (n.kategorie || 'Pressemitteilung') === f.kategorie) && match(n, f.q, ['titel', 'text']));
      $('#list-meldungen').innerHTML = list.length ? list.map((n) => {
        const draft = n.status === 'Entwurf';
        return `
        <tr data-id="${esc(n.id)}">
          <td class="nowrap">${fmtDate(n.datum)}</td>
          <td class="title">${esc(n.titel)}</td>
          <td>${esc(n.kategorie || 'Pressemitteilung')}</td>
          <td><span class="tag${draft ? ' draft' : ''}">${draft ? 'Entwurf' : 'Veröffentlicht'}</span></td>
          <td class="actions"><button class="btn btn-sm" type="button" data-publish="${draft ? 'Veröffentlicht' : 'Entwurf'}">${draft ? 'Veröffentlichen' : 'Zurückziehen'}</button> ${editBtns('meldungen')}</td>
        </tr>`;
      }).join('') : emptyRow(5, 'Keine Meldungen gefunden.');
    },

    gesetze() {
      const f = filters.gesetze || {};
      const list = data.gesetze.slice().sort((a, b) => (a.zieltag || 999) - (b.zieltag || 999))
        .filter((g) => (!f.stand || g.stand === f.stand) && match(g, f.q, ['titel', 'kurz', 'ziel', 'kernpunkte', 'bereich']));
      $('#list-gesetze').innerHTML = list.length ? list.map((g) => `
        <tr data-id="${esc(g.id)}">
          <td class="title">${esc(g.titel)}<small>${esc([g.kurz, g.bereich].filter(Boolean).join(' · '))}</small></td>
          <td><select class="inline" data-field="stand" aria-label="Stand">${options(LAW_STAGES, g.stand)}</select></td>
          <td class="nowrap">${g.zieltag ? `Tag ${g.zieltag}<br><small class="muted">${esc(dueLabel(g.zieltag, g.stand))}</small>` : '–'}</td>
          <td>${esc(g.naechsterSchritt || '–')}</td>
          <td class="actions">${editBtns('gesetze')}</td>
        </tr>`).join('') : emptyRow(5, 'Keine Gesetze gefunden.');
    },

    termine() {
      const f = filters.termine || {};
      const t = B.today();
      const list = data.termine.slice().sort(byDateAsc).filter((e) => (!f.zeitraum || (f.zeitraum === 'next' ? e.datum >= t : e.datum < t))
        && match(e, f.q, ['titel', 'ort', 'beschreibung']));
      $('#list-termine').innerHTML = list.length ? list.map((e) => `
        <tr data-id="${esc(e.id)}"${e.datum < t ? ' style="opacity:.6"' : ''}>
          <td class="nowrap">${fmtDate(e.datum)}${e.zeit ? `<br><small class="muted">${esc(e.zeit)} Uhr</small>` : ''}</td>
          <td class="title">${esc(e.titel)}</td>
          <td>${esc(e.art || 'Termin')}</td>
          <td>${esc(e.ort || '–')}</td>
          <td class="actions">${editBtns('termine')}</td>
        </tr>`).join('') : emptyRow(5, 'Keine Termine gefunden.');
    },

    kontakt() {
      const f = filters.kontakt || {};
      const open = new Set($$('#list-kontakt details[open]').map((d) => d.dataset.id));
      const drafts = new Map($$('#list-kontakt [data-note]').map((t) => [t.closest('[data-id]').dataset.id, t.value]));
      const antwortEntw = new Map($$('#list-kontakt [data-antwort]').map((t) => [t.closest('[data-id]').dataset.id, t.value]));
      const frageEntw = new Map($$('#list-kontakt [data-frage]').map((t) => [t.closest('[data-id]').dataset.id, t.value]));
      const list = data.kontakt.slice().sort((a, b) => String(b.eingang).localeCompare(String(a.eingang)))
        .filter((k) => (!f.gelesen || (f.gelesen === 'neu' ? !k.gelesen : f.gelesen === 'dialog' ? (k.oeffentlichOk && !k.veroeffentlicht) : f.gelesen === 'online' ? k.veroeffentlicht : k.gelesen)) && (!f.betreff || k.betreff === f.betreff)
          && match(k, f.q, ['name', 'email', 'nachricht', 'notiz']));
      $('#list-kontakt').innerHTML = list.length ? list.map((k) => {
        const antwort = antwortEntw.get(k.id) ?? k.antwort ?? '';
        const reply = `mailto:${encodeURIComponent(k.email).replace(/%40/g, '@')}?subject=${encodeURIComponent(`Ihre ${k.betreff}`)}${antwort ? `&body=${encodeURIComponent(`Guten Tag ${k.name},\n\n${antwort}\n\nMit freundlichen Grüßen\nBundesministerium für Inneres und Heimat`)}` : ''}`;
        const dialogTag = k.veroeffentlicht ? '<span class="tag ok">Im Bürgerdialog</span>' : k.oeffentlichOk ? '<span class="tag blau">Darf öffentlich</span>' : '';
        return `
        <details class="mail${k.gelesen ? '' : ' unread'}" data-id="${esc(k.id)}"${open.has(k.id) ? ' open' : ''}>
          <summary><div><strong>${esc(k.betreff)} · ${esc(k.name)}</strong><small>${esc(k.email)} · ${esc(dateTime(k.eingang))}</small></div><span class="row-actions" style="margin:0">${dialogTag}<span class="tag${k.gelesen ? '' : ' draft'}">${k.gelesen ? 'Gelesen' : 'Neu'}</span></span></summary>
          <div class="mail-body">
            <div class="mail-text">${esc(k.nachricht)}</div>
            <div class="antwort-box">
              <h4>Antwort ${k.oeffentlichOk ? '<span class="zust ja">darf im Bürgerdialog erscheinen</span>' : '<span class="zust">nur persönlich, nicht öffentlich</span>'}${k.antwortDatum ? `<small class="muted">gespeichert am ${esc(fmtDate(k.antwortDatum))}</small>` : ''}</h4>
              <textarea maxlength="4000" data-antwort placeholder="Ihre Antwort in einfachen Worten …">${esc(antwort)}</textarea>
              ${k.oeffentlichOk ? `<label class="mail-note">Frage, wie sie öffentlich erscheint <small class="muted">(kürzen oder Namen entfernen)</small><textarea maxlength="1000" data-frage rows="2">${esc(frageEntw.get(k.id) ?? k.frageOeffentlich ?? k.nachricht.slice(0, 1000))}</textarea></label>` : ''}
              <div class="row-actions" style="margin-top:0">
                <button class="btn btn-sm btn-primary" type="button" data-save-antwort>Antwort speichern</button>
                <a class="btn btn-sm" href="${esc(reply)}">Per E-Mail senden</a>
                ${k.oeffentlichOk ? `<button class="btn btn-sm${k.veroeffentlicht ? '' : ' btn-gold'}" type="button" data-dialog="${k.veroeffentlicht ? 'false' : 'true'}">${k.veroeffentlicht ? 'Aus dem Bürgerdialog nehmen' : 'Im Bürgerdialog veröffentlichen'}</button>` : ''}
              </div>
            </div>
            <label class="mail-note">Interne Notiz <textarea maxlength="1000" data-note>${esc(drafts.get(k.id) ?? k.notiz ?? '')}</textarea></label>
            <div class="row-actions" style="margin-top:0">
              <button class="btn btn-sm" type="button" data-read="${k.gelesen ? 'false' : 'true'}">${k.gelesen ? 'Als ungelesen markieren' : 'Als gelesen markieren'}</button>
              <button class="btn btn-sm" type="button" data-save-note>Notiz speichern</button>
              <button class="btn btn-sm btn-danger" type="button" data-del="kontakt">Löschen</button>
            </div>
          </div>
        </details>`;
      }).join('') : '<div class="empty">Keine Nachrichten.</div>';
    },

    protokoll() {
      const f = filters.protokoll || {};
      const list = data.protokoll.filter((a) => (!f.aktion || a.aktion === f.aktion) && match(a, f.q, ['aktion', 'bereich', 'objekt', 'user']));
      $('#list-protokoll').innerHTML = list.length ? list.map((a) => `
        <tr><td class="nowrap">${esc(dateTime(a.zeit))}</td><td>${esc(a.aktion)}</td><td>${esc(a.bereich)}</td><td>${esc(a.objekt || '–')}</td><td>${esc(a.user)}</td></tr>`).join('')
        : emptyRow(5, 'Keine Einträge.');
    },

    settings() {
      const form = $('#settings');
      const s = data.settings;
      form.eilmeldungAktiv.checked = Boolean(s.eilmeldungAktiv);
      form.wartungAktiv.checked = Boolean(s.wartungAktiv);
      SETTINGS_TEXT.forEach((k) => { form[k].value = s[k] || ''; });
      preview();
      run(loadDevInfo);
    },

    session() {
      if (!session) return;
      $('#session-facts').innerHTML = `
        <dt>Benutzer</dt><dd>${esc(session.user)}</dd>
        <dt>Läuft ab</dt><dd>${esc(dateTime(session.exp))}</dd>
        <dt>Aktive Sitzungen</dt><dd>${esc(session.sitzungen ?? 1)}</dd>`;
    }
  };

  // Cockpit: Begrüßung, 100-Tage-Ring, „Heute wichtig“ und Aktivität der letzten 14 Tage.
  const ICON = {
    frist: '<i data-ikon="uhr"></i>',
    post: '<i data-ikon="brief"></i>',
    presse: '<i data-ikon="zeitung"></i>',
    termin: '<i data-ikon="kalender"></i>',
    gesetz: '<i data-ikon="paragraf"></i>',
    dialog: '<i data-ikon="dialog"></i>'
  };
  function cockpit(t) {
    // formatToParts: format() liefert „05 Uhr“, Number() daraus wäre NaN und ergab immer „Guten Abend“
    const std = Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).formatToParts(new Date()).find(x => x.type === 'hour')?.value);
    const gruss = std >= 4 && std < 11 ? 'Guten Morgen' : std >= 11 && std < 18 ? 'Guten Tag' : 'Guten Abend';
    $('#dash-gruss').innerHTML = `${gruss}, <em>Herr Minister.</em>`;
    $('#dash-gruss-k').textContent = `Hausleitung · ${fmtDate(t)}`;
    const ring = $('#dash-ring .fg');
    requestAnimationFrame(() => ring.setAttribute('stroke-dashoffset', String(100 - B.DAY)));
    $('#ring-tag').textContent = B.DAY;

    const in3 = new Date(Date.parse(t) + 3 * 86400000).toISOString().slice(0, 10);
    const offen = data.massnahmen.filter((m) => m.status !== 'Abgeschlossen' && m.frist);
    const ueber = offen.filter((m) => m.frist < t);
    const bald = offen.filter((m) => m.frist >= t && m.frist <= in3);
    const entw = data.meldungen.filter((n) => n.status === 'Entwurf');
    const neu = data.kontakt.filter((k) => !k.gelesen);
    const dialog = data.kontakt.filter((k) => k.oeffentlichOk && !k.antwort);
    const heute = data.termine.filter((e) => e.datum === t).sort(byDateAsc);
    const gesetze = data.gesetze.filter((g) => g.zieltag && g.zieltag < B.DAY && !B.LAW_DONE.includes(g.stand));
    const items = [
      [ueber.length, 'frist', 'var(--err)', `${ueber.length === 1 ? 'Maßnahme' : 'Maßnahmen'} über der Frist`, ueber.map((m) => m.titel).slice(0, 2).join(' · '), 'massnahmen'],
      [heute.length, 'termin', 'var(--gold)', `${heute.length === 1 ? 'Termin' : 'Termine'} heute`, heute.map((e) => `${e.zeit ? `${e.zeit} ` : ''}${e.titel}`).slice(0, 2).join(' · '), 'termine'],
      [neu.length, 'post', 'var(--gold)', `${neu.length === 1 ? 'neue Nachricht' : 'neue Nachrichten'} im Postfach`, neu.map((k) => k.betreff).slice(0, 2).join(' · '), 'kontakt'],
      [dialog.length, 'dialog', 'var(--s-arbeit)', `${dialog.length === 1 ? 'Frage wartet' : 'Fragen warten'} auf eine öffentliche Antwort`, 'Bürgerdialog auf der Webseite', 'kontakt'],
      [bald.length, 'frist', 'var(--warn)', `Frist in den nächsten 3 Tagen`, bald.map((m) => `${m.titel} (${fmtDate(m.frist)})`).slice(0, 2).join(' · '), 'massnahmen'],
      [entw.length, 'presse', 'var(--text-2)', `${entw.length === 1 ? 'Entwurf' : 'Entwürfe'} in der Presse`, entw.map((n) => n.titel).slice(0, 2).join(' · '), 'meldungen'],
      [gesetze.length, 'gesetz', 'var(--err)', `${gesetze.length === 1 ? 'Gesetz' : 'Gesetze'} hinter dem Zieltag`, gesetze.map((g) => g.kurz || g.titel).join(' · '), 'gesetze']
    ].filter(([n]) => n > 0);
    $('#dash-todo').innerHTML = items.length ? items.map(([n, ic, c, l, sub, ziel]) => `
      <button type="button" data-goto="${ziel}" style="--c:${c}"><span class="ic">${ICON[ic]}</span><span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="n">${n}</span></button>`).join('')
      : '<div class="todo-leer"><b>Alles erledigt.</b> Keine offenen Fristen, Nachrichten oder Entwürfe.</div>';
    const nAll = items.reduce((a, [n]) => a + n, 0);
    $('#dash-satz').textContent = nAll ? `Heute ist Amtstag ${B.DAY}. ${nAll} ${nAll === 1 ? 'Punkt braucht' : 'Punkte brauchen'} Ihre Aufmerksamkeit.` : `Heute ist Amtstag ${B.DAY}. Alles ist auf dem aktuellen Stand.`;

    // Aktivität aus dem Protokoll (ohne Anmeldungen)
    const tage = [...Array(14)].map((_, i) => new Date(Date.parse(t) - (13 - i) * 86400000).toISOString().slice(0, 10));
    const zaehl = Object.fromEntries(tage.map((d) => [d, 0]));
    const arbeit = data.protokoll.filter((a) => !/Anmeldung|Dev-/.test(a.aktion));
    arbeit.forEach((a) => {
      const d = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(a.zeit));
      if (d in zaehl) zaehl[d] += 1;
    });
    const max = Math.max(1, ...Object.values(zaehl));
    const woche = tage.slice(7).reduce((a, d) => a + zaehl[d], 0);
    const veroeff = data.meldungen.filter((n) => n.status !== 'Entwurf' && n.datum >= tage[7]).length;
    $('#dash-aktiv').innerHTML = `
      <div class="aktiv-sum"><div><b>${woche}</b><span>Änderungen diese Woche</span></div><div><b>${veroeff}</b><span>Meldungen veröffentlicht</span></div><div><b>${zaehl[t]}</b><span>heute</span></div></div>
      <div class="aktiv-chart" role="img" aria-label="Änderungen pro Tag">${tage.map((d) => `<i class="${d === t ? 'heute' : ''}" style="--h:${Math.round((zaehl[d] / max) * 100)}%" title="${fmtDate(d)}: ${zaehl[d]}"></i>`).join('')}</div>
      <div class="aktiv-achse"><span>${fmtDate(tage[0])}</span><span>heute</span></div>`;
  }

  const SETTINGS_TEXT = ['wartungTitel', 'wartungText', 'wartungDatum', 'wartungZeit', 'eilmeldung', 'heroTitel', 'heroText', 'ministerZitat', 'heroTitelEn', 'heroTextEn', 'ministerZitatEn'];

  async function loadDevInfo() {
    const info = await api('GET', 'gate/info');
    const src = info.quelle === 'Verwaltung' ? 'in der Verwaltung erzeugt' : 'auf dem Server hinterlegt';
    $('#dev-info').textContent = info.codeGesetzt
      ? `Ein Dev-Code ist ${src}. Aktive Freischaltungen: ${info.freischaltungen}. Jede Freischaltung endet beim Schließen des Browsers oder nach 60 Minuten.`
      : 'Noch kein Dev-Code gesetzt. Ohne Code kommt bei gesperrter Webseite niemand durch.';
  }

  $('#dev-new').addEventListener('click', () => {
    if (!confirm('Neuen Dev-Code erzeugen? Der bisherige Code wird sofort ungültig und alle Freischaltungen enden.')) return;
    run(async () => {
      const { code } = await api('POST', 'gate/code', {});
      $('#dev-value').textContent = code;
      $('#dev-show').hidden = false;
      toast('Neuer Dev-Code erzeugt.');
      await loadDevInfo();
      await refresh('protokoll');
    });
  });
  $('#dev-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText($('#dev-value').textContent).then(() => toast('Kopiert.'), () => toast('Kopieren nicht möglich, bitte markieren.', false));
  });
  $('#dev-hide').addEventListener('click', () => { $('#dev-value').textContent = ''; $('#dev-show').hidden = true; });

  function preview() {
    const form = $('#settings');
    const p = $('#eil-preview');
    p.querySelector('span').textContent = form.eilmeldung.value || 'Kein Text';
    p.classList.toggle('off', !form.eilmeldungAktiv.checked);
  }

  // Für assets/admin-bfv.js (Verbindung zum Verfassungsschutz)
  window.BMIH_ADMIN = { api, toast, run, dateTime, emptyRow, data, filters, openEditor, refresh, go: (n) => go(n), FIELDS, options };

  // --- Navigation --------------------------------------------------------------

  function go(name) {
    tab = name;
    $$('.side-nav button').forEach((b) => (b.dataset.tab === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    $$('.tab').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    const label = $(`.side-nav [data-tab="${CSS.escape(name)}"]`);
    if (label && $('#crumb-tab')) $('#crumb-tab').textContent = [...label.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (history.replaceState) history.replaceState(null, '', `#${name}`);
    if (name === 'system') run(loadSession);
    document.dispatchEvent(new CustomEvent('admin:tab', { detail: name }));
    $('#main').focus?.();
    scrollTo({ top: 0 });
  }
  $('.side-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });

  // --- Ereignisse --------------------------------------------------------------

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !$('#app').contains(t)) return;
    const row = t.closest('[data-id]');
    const id = row?.dataset.id;

    if (t.dataset.goto) return go(t.dataset.goto);
    if (t.dataset.new) return openEditor(t.dataset.new, null);
    if (t.dataset.edit) return openEditor(t.dataset.edit, data[t.dataset.edit].find((x) => x.id === id));
    if (t.dataset.del) {
      const col = t.dataset.del;
      const item = data[col].find((x) => x.id === id);
      const name = item?.titel || (item ? `${item.betreff} von ${item.name}` : 'Eintrag');
      if (!confirm(`„${name}“ wirklich löschen?`)) return;
      return run(async () => { await api('DELETE', `${col}/${encodeURIComponent(id)}`); toast('Gelöscht.'); await refresh(col); });
    }
    if (t.dataset.publish) {
      return run(async () => { await api('PUT', `meldungen/${encodeURIComponent(id)}`, { status: t.dataset.publish }); toast(t.dataset.publish === 'Entwurf' ? 'Zurückgezogen.' : 'Veröffentlicht.'); await refresh('meldungen'); });
    }
    if (t.dataset.read) {
      return run(async () => { await api('PUT', `kontakt/${encodeURIComponent(id)}`, { gelesen: t.dataset.read === 'true' }); await refresh('kontakt'); });
    }
    if (t.hasAttribute('data-save-antwort') || t.dataset.dialog) {
      const body = { antwort: row.querySelector('[data-antwort]').value.trim() };
      const frage = row.querySelector('[data-frage]');
      if (frage) body.frageOeffentlich = frage.value.trim();
      if (t.dataset.dialog) body.veroeffentlicht = t.dataset.dialog === 'true';
      return run(async () => {
        await api('PUT', `kontakt/${encodeURIComponent(id)}`, body);
        toast(t.dataset.dialog ? (body.veroeffentlicht ? 'Im Bürgerdialog veröffentlicht.' : 'Aus dem Bürgerdialog genommen.') : 'Antwort gespeichert.');
        $$('#list-kontakt [data-id="' + CSS.escape(id) + '"] textarea').forEach((x) => { x.removeAttribute('data-antwort'); x.removeAttribute('data-frage'); });
        await refresh('kontakt');
      });
    }
    if (t.hasAttribute('data-save-note')) {
      const notiz = row.querySelector('[data-note]').value.trim();
      return run(async () => { await api('PUT', `kontakt/${encodeURIComponent(id)}`, { notiz }); toast('Notiz gespeichert.'); await refresh('kontakt'); });
    }
  });

  // Status direkt in der Tabelle ändern
  $('#list-massnahmen').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-field]');
    if (!sel) return;
    const id = sel.closest('[data-id]').dataset.id;
    const body = { [sel.dataset.field]: sel.value };
    const item = data.massnahmen.find((m) => m.id === id);
    if (sel.value === 'Abgeschlossen') body.fortschritt = 100;
    else if (sel.value === 'Offen' && item && progressOf(item) === 100) body.fortschritt = 0;
    run(async () => { await api('PUT', `massnahmen/${encodeURIComponent(id)}`, body); toast('Status gespeichert.'); await refresh('massnahmen'); });
  });

  // Ungelesene Nachricht beim Aufklappen als gelesen markieren
  $('#list-kontakt').addEventListener('click', (e) => {
    const sum = e.target.closest('summary');
    const d = sum?.parentElement;
    if (!d || d.open || !d.classList.contains('unread')) return; // nur beim Aufklappen durch den Nutzer
    run(async () => { await api('PUT', `kontakt/${encodeURIComponent(d.dataset.id)}`, { gelesen: true }); await refresh('kontakt'); });
  });

  $('#mark-all').addEventListener('click', () => run(async () => {
    const unread = data.kontakt.filter((k) => !k.gelesen);
    for (const k of unread) await api('PUT', `kontakt/${encodeURIComponent(k.id)}`, { gelesen: true });
    toast(unread.length ? `${unread.length} Nachricht(en) als gelesen markiert.` : 'Keine ungelesenen Nachrichten.');
    await refresh('kontakt');
  }));

  // Filter in den Werkzeugleisten
  $$('.tab[data-panel]').forEach((panel) => {
    const key = panel.dataset.panel;
    panel.querySelectorAll('[data-filter]').forEach((el) => {
      el.addEventListener('input', () => {
        filters[key] = { ...(filters[key] || {}), [el.dataset.filter]: el.value };
        render[key]?.();
        fillBars(panel);
      });
    });
  });
  $('[data-panel="massnahmen"] [data-filter="phase"]').insertAdjacentHTML('beforeend', options(PHASES));
  $('[data-panel="massnahmen"] [data-filter="status"]').insertAdjacentHTML('beforeend', options(STATUSES));
  $('[data-panel="meldungen"] [data-filter="kategorie"]').insertAdjacentHTML('beforeend', options(NEWS_KIND));
  $('[data-panel="gesetze"] [data-filter="stand"]').insertAdjacentHTML('beforeend', options(LAW_STAGES));

  // Stand eines Gesetzes direkt in der Tabelle ändern
  $('#list-gesetze').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-field]');
    if (!sel) return;
    const id = sel.closest('[data-id]').dataset.id;
    run(async () => { await api('PUT', `gesetze/${encodeURIComponent(id)}`, { stand: sel.value }); toast('Stand gespeichert.'); await refresh('gesetze'); });
  });

  $('#settings').addEventListener('input', preview);
  $('#settings').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = { eilmeldungAktiv: form.eilmeldungAktiv.checked, wartungAktiv: form.wartungAktiv.checked };
    SETTINGS_TEXT.forEach((k) => { body[k] = form[k].value.trim(); });
    if (body.eilmeldungAktiv && !body.eilmeldung) { toast('Bitte einen Text für die Eilmeldung eingeben.', false); return; }
    if (body.wartungAktiv && !body.wartungTitel) { toast('Bitte eine Überschrift für die Warteseite eingeben.', false); return; }
    if (body.wartungAktiv !== Boolean(data.settings.wartungAktiv) && !confirm(body.wartungAktiv
      ? 'Webseite jetzt sperren? Besucher sehen nur noch die Warteseite.'
      : 'Webseite jetzt freigeben? Alle sehen wieder die normalen Seiten.')) return;
    run(async () => { data.settings = await api('PUT', 'settings', body); toast('Einstellungen gespeichert.'); render.settings(); await refresh('protokoll'); });
  });

  // --- Sitzung -----------------------------------------------------------------

  function showLogin(reason) {
    session = null;
    $('#app').hidden = true;
    $('#login-view').hidden = false;
    const msg = $('#login-msg');
    msg.textContent = reason || '';
    msg.className = 'msg err';
  }

  async function loadSession() {
    session = await api('GET', 'session');
    render.session();
  }

  let clock;
  function tick() {
    if (!session) return;
    const left = session.exp - Date.now();
    if (left <= 0) { showLogin('Sitzung abgelaufen. Bitte neu anmelden.'); return; }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    $('#expires').textContent = `Sitzung endet in ${h}:${String(m).padStart(2, '0')} h`;
  }

  async function enter(s) {
    session = s;
    $('#who').textContent = s.user;
    $('#login-view').hidden = true;
    $('#app').hidden = false;
    clearInterval(clock);
    clock = setInterval(tick, 30000);
    tick();
    await refresh();
    render.settings();
    render.session();
    const start = location.hash.slice(1);
    go($(`.side-nav [data-tab="${CSS.escape(start)}"]`) ? start : 'dashboard');
  }

  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#login-msg');
    const btn = form.querySelector('button');
    btn.disabled = true;
    msg.textContent = '';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.value, password: form.password.value })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Anmeldung fehlgeschlagen.');
      form.reset();
      await enter(await api('GET', 'session'));
    } catch (err) {
      msg.className = 'msg err';
      msg.textContent = err instanceof TypeError ? 'Server nicht erreichbar.' : err.message;
    } finally {
      btn.disabled = false;
    }
  });

  async function logout(all) {
    clearInterval(clock);
    await fetch(`/api/logout${all ? '?alle=1' : ''}`, { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    showLogin(all ? 'Alle Sitzungen wurden beendet.' : 'Abgemeldet.');
    $('#login-msg').className = 'msg ok';
  }
  $('#logout').addEventListener('click', () => logout(false));
  $('#logout-all').addEventListener('click', () => { if (confirm('Alle aktiven Sitzungen beenden? Sie werden ebenfalls abgemeldet.')) logout(true); });

  fetch('/api/session', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json().then(enter) : showLogin()))
    .catch(() => showLogin('Server nicht erreichbar.'));
})();
