// Verwaltung, Zusatzwerkzeuge: Schnellsuche (Strg+K), Menü „+ Neu“, Uhr, Maßnahmen-Board,
// Terminkalender und Live-Vorschau für Pressemitteilungen. Alle Inhalte werden mit esc() maskiert.
(() => {
  const B = window.BMIH;
  const A = window.BMIH_ADMIN;
  const { esc, fmtDate, STATUSES, progressOf, byDateAsc } = B;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const merk = {
    get(k, d) { try { return localStorage.getItem(`bmih-admin-${k}`) || d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(`bmih-admin-${k}`, v); } catch (_) { /* egal */ } }
  };

  // --- Uhr in der Kopfzeile -----------------------------------------------------
  const uhr = $('#live-uhr span');
  const zeitFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const tickUhr = () => { if (uhr) uhr.textContent = `Berlin ${zeitFmt.format(new Date())} · Tag ${B.DAY}`; };
  tickUhr();
  setInterval(tickUhr, 20000);

  // --- Menü „+ Neu“ ---------------------------------------------------------------
  const neuBtn = $('#neu-btn');
  const neuListe = $('#neu-liste');
  const neuZu = () => { neuListe.hidden = true; neuBtn.setAttribute('aria-expanded', 'false'); };
  neuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const auf = neuListe.hidden;
    neuListe.hidden = !auf;
    neuBtn.setAttribute('aria-expanded', String(auf));
    if (auf) neuListe.querySelector('button').focus();
  });
  neuListe.addEventListener('click', () => setTimeout(neuZu));
  document.addEventListener('click', (e) => { if (!e.target.closest('.neu-menu')) neuZu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !neuListe.hidden) { neuZu(); neuBtn.focus(); } });

  // --- Ansicht umschalten (Board/Kalender oder Liste) -----------------------------
  function ansicht(key, v) {
    const seg = $(`.seg[data-ansicht="${key}"]`);
    if (!seg) return;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    $(`[data-liste="${key}"]`).hidden = v !== 'liste';
    (key === 'massnahmen' ? $('#board-massnahmen') : $('#kal-termine')).hidden = v === 'liste';
    merk.set(`ansicht-${key}`, v);
  }
  $$('.seg[data-ansicht]').forEach((seg) => {
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) ansicht(seg.dataset.ansicht, b.dataset.v); });
    ansicht(seg.dataset.ansicht, merk.get(`ansicht-${seg.dataset.ansicht}`, 'board'));
  });

  // --- Maßnahmen-Board ------------------------------------------------------------
  const FARBE = { 'Offen': 'var(--s-offen)', 'In Arbeit': 'var(--s-arbeit)', 'Im Kabinett': 'var(--s-kabinett)', 'Abgeschlossen': 'var(--s-fertig)' };
  const match = (obj, q, keys) => !q || keys.map((k) => obj[k] || '').join(' ').toLowerCase().includes(q.toLowerCase());

  function board() {
    const f = A.filters.massnahmen || {};
    const heute = B.today();
    const list = A.data.massnahmen.filter((m) => (!f.phase || m.phase === f.phase) && (!f.status || m.status === f.status)
      && match(m, f.q, ['titel', 'bereich', 'beschreibung', 'verantwortlich']));
    $('#board-massnahmen').innerHTML = STATUSES.map((st, i) => {
      const karten = list.filter((m) => m.status === st).sort((a, b) => String(a.frist || '9').localeCompare(String(b.frist || '9')));
      return `
      <section class="lane" data-status="${esc(st)}" aria-label="${esc(st)}">
        <div class="lane-head" style="--c:${FARBE[st]}"><i></i>${esc(st)}<span>${karten.length}</span></div>
        <div class="lane-body">${karten.map((m) => {
          const spaet = m.frist && m.frist < heute && st !== 'Abgeschlossen';
          return `
          <article class="kart" draggable="true" data-id="${esc(m.id)}" tabindex="0" aria-label="${esc(m.titel)}">
            <h4>${esc(m.titel)}</h4>
            <div class="meta"><span>${esc(m.phase)}</span>${m.bereich ? `<span>${esc(m.bereich)}</span>` : ''}${m.frist ? `<span class="${spaet ? 'spaet' : ''}">${spaet ? 'überfällig · ' : 'bis '}${fmtDate(m.frist)}</span>` : ''}</div>
            <div style="--c:${FARBE[st]}">${B.bar(progressOf(m), false)}</div>
            <div class="zeile">
              <button type="button" data-schieb="-1" ${i === 0 ? 'disabled' : ''} aria-label="Eine Spalte zurück">←</button>
              <button type="button" data-schieb="1" ${i === STATUSES.length - 1 ? 'disabled' : ''} aria-label="Eine Spalte weiter">→</button>
              <span class="sp"></span>
              <span class="zaehler">${progressOf(m)} %</span>
              <button type="button" data-edit="massnahmen">Öffnen</button>
            </div>
          </article>`;
        }).join('') || '<p class="zaehler" style="padding:8px 4px">Leer</p>'}</div>
      </section>`;
    }).join('');
    B.fillBars($('#board-massnahmen'));
  }

  async function setzeStatus(id, status) {
    const item = A.data.massnahmen.find((m) => m.id === id);
    if (!item || item.status === status) return;
    const body = { status };
    if (status === 'Abgeschlossen') body.fortschritt = 100;
    else if (status === 'Offen' && progressOf(item) === 100) body.fortschritt = 0;
    await A.run(async () => {
      await A.api('PUT', `massnahmen/${encodeURIComponent(id)}`, body);
      A.toast(`„${item.titel}“ → ${status}`);
      await A.refresh('massnahmen');
    });
  }

  const boardEl = $('#board-massnahmen');
  let gezogen = null;
  boardEl.addEventListener('dragstart', (e) => {
    const k = e.target.closest('.kart');
    if (!k) return;
    gezogen = k.dataset.id;
    k.classList.add('zieht');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', gezogen);
  });
  boardEl.addEventListener('dragend', () => { gezogen = null; $$('.kart.zieht, .lane.ueber', boardEl).forEach((x) => x.classList.remove('zieht', 'ueber')); });
  boardEl.addEventListener('dragover', (e) => {
    const lane = e.target.closest('.lane');
    if (!lane || !gezogen) return;
    e.preventDefault();
    $$('.lane.ueber', boardEl).forEach((x) => x !== lane && x.classList.remove('ueber'));
    lane.classList.add('ueber');
  });
  boardEl.addEventListener('drop', (e) => {
    const lane = e.target.closest('.lane');
    if (!lane || !gezogen) return;
    e.preventDefault();
    const id = gezogen;
    gezogen = null;
    setzeStatus(id, lane.dataset.status);
  });
  boardEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-schieb]');
    if (!b) return;
    const id = b.closest('.kart').dataset.id;
    const item = A.data.massnahmen.find((m) => m.id === id);
    const i = STATUSES.indexOf(item.status) + Number(b.dataset.schieb);
    if (STATUSES[i]) setzeStatus(id, STATUSES[i]);
  });
  const oeffneKarte = (k) => A.openEditor('massnahmen', A.data.massnahmen.find((m) => m.id === k.dataset.id));
  boardEl.addEventListener('dblclick', (e) => { const k = e.target.closest('.kart'); if (k) oeffneKarte(k); });
  boardEl.addEventListener('keydown', (e) => { const k = e.target.closest('.kart'); if (k && e.key === 'Enter' && e.target === k) oeffneKarte(k); });

  // --- Terminkalender ---------------------------------------------------------------
  const ART_FARBE = { 'Termin': 'var(--text-2)', 'Pressekonferenz': 'var(--gold)', 'Kabinett': 'var(--s-kabinett)', 'Bundestag': 'var(--s-arbeit)', 'Reise': 'var(--s-fertig)' };
  let monat = B.today().slice(0, 7);
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const iso = (d) => d.toISOString().slice(0, 10);
  function amtstag(datum) {
    const n = Math.round((Date.parse(datum) - Date.parse(B.dayDate(1))) / 86400000) + 1;
    return n >= 1 && n <= 100 ? n : 0;
  }
  function kalender() {
    const erster = new Date(`${monat}-01T12:00:00Z`);
    const versatz = (erster.getUTCDay() + 6) % 7; // Montag zuerst
    const beginn = new Date(erster.getTime() - versatz * 86400000);
    const heute = B.today();
    const f = A.filters.termine || {};
    const nachTag = {};
    A.data.termine.filter((e) => match(e, f.q, ['titel', 'ort', 'beschreibung'])).sort(byDateAsc)
      .forEach((e) => { (nachTag[e.datum] ||= []).push(e); });
    const anzahl = A.data.termine.filter((e) => String(e.datum).startsWith(monat)).length;
    const zellen = [...Array(42)].map((_, i) => {
      const d = iso(new Date(beginn.getTime() + i * 86400000));
      const evs = nachTag[d] || [];
      const at = amtstag(d);
      return `
        <div class="kal-tag${d.slice(0, 7) !== monat ? ' fremd' : ''}${d === heute ? ' heute' : ''}" data-tag="${d}" role="gridcell" aria-label="${fmtDate(d)}${evs.length ? `, ${evs.length} Termine` : ''}">
          <div class="top"><span class="nr">${Number(d.slice(8))}</span>${at ? `<span class="amt">Tag ${at}</span>` : ''}</div>
          ${evs.slice(0, 3).map((e) => `<button type="button" class="kal-ev" data-ev="${esc(e.id)}" style="--c:${ART_FARBE[e.art] || 'var(--text-2)'}" title="${esc(`${e.zeit ? `${e.zeit} Uhr · ` : ''}${e.titel}${e.ort ? ` · ${e.ort}` : ''}`)}">${e.zeit ? `${esc(e.zeit)} ` : ''}${esc(e.titel)}</button>`).join('')}
          ${evs.length > 3 ? `<span class="zaehler">+ ${evs.length - 3} weitere</span>` : ''}
        </div>`;
    }).join('');
    $('#kal-termine').innerHTML = `
      <div class="kal-head">
        <h3>${MONATE[Number(monat.slice(5)) - 1]} <em>${monat.slice(0, 4)}</em></h3>
        <span class="zaehler">${anzahl} ${anzahl === 1 ? 'Termin' : 'Termine'} · Klick auf einen Tag legt einen Termin an</span>
        <span class="sp"></span>
        <button class="btn btn-sm" type="button" data-kal="-1" aria-label="Voriger Monat">←</button>
        <button class="btn btn-sm" type="button" data-kal="0">Heute</button>
        <button class="btn btn-sm" type="button" data-kal="1" aria-label="Nächster Monat">→</button>
      </div>
      <div class="kal-grid" role="grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<div class="wt">${w}</div>`).join('')}${zellen}</div>`;
  }
  $('#kal-termine').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-kal]');
    if (nav) {
      const n = Number(nav.dataset.kal);
      if (!n) monat = B.today().slice(0, 7);
      else {
        const d = new Date(`${monat}-15T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + n);
        monat = iso(d).slice(0, 7);
      }
      return kalender();
    }
    const ev = e.target.closest('[data-ev]');
    if (ev) return A.openEditor('termine', A.data.termine.find((x) => x.id === ev.dataset.ev));
    const tag = e.target.closest('[data-tag]');
    if (tag) {
      A.openEditor('termine', null);
      const feld = $('#editor-fields [name="datum"]');
      if (feld) feld.value = tag.dataset.tag;
    }
  });

  document.addEventListener('admin:render', () => { board(); kalender(); });
  $$('[data-panel="massnahmen"] [data-filter], [data-panel="termine"] [data-filter]').forEach((el) => el.addEventListener('input', () => { board(); kalender(); }));

  // --- Presse: Live-Vorschau und Bildauswahl -------------------------------------
  let fotos = [];

  function vorschau() {
    const form = $('#editor-form');
    if (!$('#pv-karte') || !form.elements.teaser) return;
    const el = form.elements;
    const n = {
      id: 'vorschau', titel: el.titel.value.trim() || 'Überschrift der Meldung', text: el.text.value.trim(),
      teaser: el.teaser.value.trim(), datum: el.datum.value, kategorie: el.kategorie.value, bild: el.bild.value, status: el.status.value
    };
    const foto = B.fotoFor(n, fotos);
    const kurz = n.teaser || n.text.slice(0, 220) + (n.text.length > 220 ? ' …' : '');
    const woerter = n.text.split(/\s+/).filter(Boolean).length;
    $('#pv-karte').innerHTML = `
      <article class="pv-card">
        <div class="pv-img" style="background-image:url('${foto ? esc(B.fotoSrc(foto)) : ''}')"></div>
        <div class="pv-body">
          <div class="pv-meta"><span class="tag">${esc(n.kategorie)}</span>${n.datum ? `<span>${fmtDate(n.datum)}</span>` : ''}${n.status === 'Entwurf' ? '<span class="tag draft">Entwurf</span>' : ''}${el.oben.checked ? '<span class="tag ok">Oben</span>' : ''}</div>
          <h3>${esc(n.titel)}</h3>
          <p>${esc(kurz || 'Hier erscheint der Kurztext.')}</p>
        </div>
      </article>`;
    $('#pv-bildinfo').textContent = n.bild ? 'Bild' : 'Bild · automatisch passend';
    $('#pv-bildname').textContent = foto ? foto.titel : '';
    $$('.bildwahl [data-bild]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bild === n.bild)));
    $('#pv-zaehler').textContent = `${n.text.length} / 6000 Zeichen · ca. ${Math.max(1, Math.round(woerter / 200))} Min. Lesezeit`;
    $('#pv-text').textContent = n.text || 'Noch kein Text.';
  }
  // Gerüst einmal beim Öffnen; danach ändern sich nur Karte und Text, die Bildauswahl bleibt stehen.
  function vorschauGeruest() {
    const box = $('#ed-vorschau');
    if (!box) return;
    const wahl = $('#editor-form').elements.bild.value || '';
    box.innerHTML = `
      <span class="kicker">So sieht es auf der Webseite aus</span>
      <div id="pv-karte"></div>
      <div class="bildwahl-head"><span id="pv-bildinfo">Bild</span><span class="zaehler" id="pv-bildname"></span></div>
      <div class="bildwahl" role="group" aria-label="Bild auswählen">
        <button type="button" class="auto" data-bild="" aria-pressed="${!wahl}">Automatisch</button>
        ${fotos.map((f) => `<button type="button" data-bild="${esc(f.id)}" aria-pressed="${f.id === wahl}" title="${esc(f.titel)}" style="background-image:url('${esc(B.fotoSrc(f, 's'))}')"><span class="sr-only">${esc(f.titel)}</span></button>`).join('')}
      </div>
      <div class="bildwahl-head"><span>Langtext</span><span class="zaehler" id="pv-zaehler"></span></div>
      <div class="pv-text" id="pv-text"></div>`;
    vorschau();
  }
  let pvTimer;
  document.addEventListener('admin:editor', (e) => {
    if (e.detail.col !== 'meldungen') return;
    B.loadFotos().then((f) => { fotos = Array.isArray(f) ? f : []; vorschauGeruest(); });
  });
  $('#editor-form').addEventListener('input', () => { if ($('#pv-karte')) { clearTimeout(pvTimer); pvTimer = setTimeout(vorschau, 120); } });
  $('#editor-form').addEventListener('change', () => { if ($('#pv-karte')) vorschau(); });
  $('#editor-form').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bild]');
    if (!b) return;
    $('#editor-form').elements.bild.value = b.dataset.bild;
    vorschau();
  });

  // --- Schnellsuche (Strg+K) -------------------------------------------------------
  const pal = $('#palette');
  const pq = $('#palette-q');
  const pl = $('#palette-liste');
  let treffer = [];
  let aktiv = 0;
  const textVon = (b) => [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();

  const BEREICHE = $$('.side-nav [data-tab]').map((b) => ({ gr: 'Bereiche', icon: '→', text: textVon(b), zusatz: 'Bereich', tun: () => A.go(b.dataset.tab) }));
  const AKTIONEN = [
    ['Neue Pressemitteilung', () => A.openEditor('meldungen', null)],
    ['Neue Maßnahme', () => A.openEditor('massnahmen', null)],
    ['Neuer Termin', () => A.openEditor('termine', null)],
    ['Neues Gesetzesvorhaben', () => A.openEditor('gesetze', null)],
    ['Erlass oder Verfügung ausfertigen', () => A.go('erlasse')],
    ['Auftrag ans BfV senden', () => A.go('auftraege')],
    ['Eilmeldung setzen', () => { A.go('einstellungen'); setTimeout(() => $('#settings [name="eilmeldung"]')?.focus(), 50); }],
    ['Fragen im Bürgerdialog beantworten', () => { A.go('kontakt'); const s = $('[data-panel="kontakt"] [data-filter="gelesen"]'); s.value = 'dialog'; s.dispatchEvent(new Event('input')); }],
    ['Webseite in neuem Tab öffnen', () => window.open('index.html', '_blank', 'noopener')],
    ['Backup herunterladen', () => { location.href = '/api/export'; }]
  ].map(([text, tun]) => ({ gr: 'Aktionen', icon: '+', text, zusatz: 'Aktion', tun }));

  function inhalte(q) {
    if (q.length < 2) return [];
    const d = A.data;
    const r = [];
    const has = (...v) => v.join(' ').toLowerCase().includes(q);
    d.meldungen.forEach((n) => has(n.titel, n.text) && r.push({ gr: 'Presse', icon: '¶', text: n.titel, zusatz: `${fmtDate(n.datum)} · ${n.status || 'Veröffentlicht'}`, tun: () => A.openEditor('meldungen', n) }));
    d.massnahmen.forEach((m) => has(m.titel, m.bereich, m.beschreibung) && r.push({ gr: 'Maßnahmen', icon: '✓', text: m.titel, zusatz: m.status, tun: () => A.openEditor('massnahmen', m) }));
    d.gesetze.forEach((g) => has(g.titel, g.kurz, g.ziel) && r.push({ gr: 'Gesetze', icon: '§', text: g.titel, zusatz: g.stand, tun: () => A.openEditor('gesetze', g) }));
    d.termine.forEach((e) => has(e.titel, e.ort) && r.push({ gr: 'Termine', icon: '◷', text: e.titel, zusatz: fmtDate(e.datum), tun: () => A.openEditor('termine', e) }));
    d.kontakt.forEach((k) => has(k.name, k.betreff, k.nachricht) && r.push({ gr: 'Postfach', icon: '✉', text: `${k.betreff} · ${k.name}`, zusatz: A.dateTime(k.eingang), tun: () => {
      A.go('kontakt');
      setTimeout(() => { const el = $(`#list-kontakt [data-id="${CSS.escape(k.id)}"]`); if (el) { el.open = true; el.scrollIntoView({ block: 'center' }); } }, 50);
    } }));
    return r.slice(0, 30);
  }

  function zeigen() {
    const q = pq.value.trim().toLowerCase();
    const passt = (x) => x.text.toLowerCase().includes(q);
    treffer = q ? [...AKTIONEN.filter(passt), ...BEREICHE.filter(passt), ...inhalte(q)] : [...AKTIONEN.slice(0, 5), ...BEREICHE];
    aktiv = Math.min(aktiv, Math.max(0, treffer.length - 1));
    let gr = '';
    pl.innerHTML = treffer.length ? treffer.map((x, i) => {
      const kopf = x.gr !== gr ? `<li class="gr" role="presentation">${esc((gr = x.gr))}</li>` : '';
      return `${kopf}<li class="it" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === aktiv}"><span class="pi" aria-hidden="true">${esc(x.icon)}</span>${esc(x.text)}<small>${esc(x.zusatz || '')}</small></li>`;
    }).join('') : '<li class="p-leer">Nichts gefunden.</li>';
    pq.setAttribute('aria-activedescendant', treffer.length ? `pal-${aktiv}` : '');
    $(`#pal-${aktiv}`)?.scrollIntoView({ block: 'nearest' });
  }
  function oeffnen() {
    if ($('#app').hidden || pal.open || $('#editor').open) return;
    pq.value = '';
    aktiv = 0;
    zeigen();
    pal.showModal();
    pq.focus();
  }
  function ausfuehren(i) {
    const x = treffer[i];
    if (!x) return;
    pal.close();
    x.tun();
  }
  pq.addEventListener('input', () => { aktiv = 0; zeigen(); });
  pq.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); aktiv = Math.min(treffer.length - 1, aktiv + 1); zeigen(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aktiv = Math.max(0, aktiv - 1); zeigen(); }
    else if (e.key === 'Enter') { e.preventDefault(); ausfuehren(aktiv); }
  });
  pl.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) ausfuehren(Number(li.dataset.i)); });
  pal.addEventListener('click', (e) => { if (e.target === pal) pal.close(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-palette]')) oeffnen(); });
  document.addEventListener('keydown', (e) => {
    const tippt = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); oeffnen(); }
    else if (e.key === '/' && !tippt && !$('#editor').open) { e.preventDefault(); oeffnen(); }
  });
  if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $$('.kbd, .side-search kbd').forEach((k) => { k.textContent = k.textContent.replace('Strg', '⌘'); });
})();
