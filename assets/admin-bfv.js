// Verwaltung: Verbindung zum Bundesamt für Verfassungsschutz (BfV).
// Aufsicht (Kennzahlen), Erlasse und Verfügungen ausfertigen, Aufträge senden, Bekanntmachungen.
// Alle Daten laufen über /api/bfv/* (BMI-Backend, verschlüsselter Kanal zum BfV). Alles wird mit esc() maskiert.
(() => {
  const A = window.BMIH_ADMIN;
  if (!A) return;
  const { esc } = window.BMIH;
  const { api, toast, run, dateTime, emptyRow } = A;
  const $ = (s, root = document) => root.querySelector(s);
  const datum = (d) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : '');

  // Standard-Belehrung wie im Dienstportal
  const BELEHRUNG = 'Gegen diese Verfügung kann innerhalb von 24 Stunden nach Bekanntgabe Widerspruch eingelegt werden. '
    + 'Der Widerspruch ist bei der Widerspruchsstelle des Bundesministeriums des Innern und für Heimat online im Antragsportal des Bundesamtes (verfassungsschutz.duckdns.org/antraege.html#widerspruch) oder über das Ticket „Widerspruch“ im Kanal Widerspruch-Klage einzulegen. '
    + 'Er muss das Aktenzeichen dieser Verfügung, den Gegenstand, die verletzte Rechtsgrundlage, einen Antrag und eine Begründung enthalten (Erlass D 1 – 001/2026, Nr. 1 Abs. 3 und 4). '
    + 'Widerspruch und Klage haben keine aufschiebende Wirkung (Nr. 1 Abs. 8).';

  const FELDER = {
    verfuegung: [
      { k: 'empfaenger', l: 'An wen geht sie?', h: 'Name und Funktion, je Zeile', t: 'textarea', rows: 2, max: 400, req: true },
      { k: 'empfaengerDiscordId', l: 'Discord-ID des Empfängers', h: 'optional, dann kommt sie per Direktnachricht', max: 20 },
      { k: 'betreff', l: 'Betreff', h: 'worum geht es, in einem Satz?', max: 200, req: true, full: true },
      { k: 'tenor', l: 'Was wird entschieden?', h: 'je Absatz ein Punkt, wird nummeriert', t: 'textarea', rows: 3, max: 4000, req: true, full: true },
      { k: 'begruendung', l: 'Warum?', h: 'kurz begründen, damit der Empfänger es versteht', t: 'textarea', rows: 4, max: 12000, full: true },
      { k: 'rechtsgrundlage', l: 'Rechtsgrundlage', h: 'optional, z. B. § 28 BBG', max: 300 },
      { k: 'bezugText', l: 'Bezug', h: 'optional, z. B. Ihr Antrag vom …', max: 200 },
      { k: 'belehrung', l: 'Hinweis, wie man sich wehren kann', h: 'leer lassen = kein Hinweis', t: 'textarea', rows: 3, max: 2000, full: true, wert: BELEHRUNG }
    ],
    erlass: [
      { k: 'titel', l: 'Titel', h: 'z. B. Erlass über …', max: 200, req: true, full: true },
      { k: 'praeambel', l: 'Einleitung', h: 'optional', t: 'textarea', rows: 2, max: 1500, full: true },
      { k: 'text', l: 'Text', h: 'Überschriften als eigene Zeile („1. …“), Absätze mit Leerzeile trennen', t: 'textarea', rows: 10, max: 30000, req: true, full: true },
      { k: 'inkrafttreten', l: 'Ab wann gilt er?', h: 'z. B. Dieser Erlass tritt mit Bekanntgabe in Kraft.', max: 400, full: true }
    ]
  };

  // --- Aufsicht -----------------------------------------------------------------

  async function verbindung() {
    const el = $('#bfv-verbindung');
    try {
      const v = await api('GET', 'bfv/verbindung');
      el.className = `verb-pill ${v.erreichbar ? 'ok' : 'aus'}`;
      el.textContent = v.erreichbar ? 'Mit dem BfV verbunden' : (v.eingerichtet ? 'BfV gerade nicht erreichbar' : 'Verbindung noch nicht eingerichtet');
      el.title = v.hinweis || '';
      return v.erreichbar;
    } catch (err) {
      el.className = 'verb-pill aus';
      el.textContent = 'BfV nicht erreichbar';
      return false;
    }
  }

  const kpi = (wert, text, farbe) => `<div class="kpi-card" style="--c:${farbe}"><b>${esc(String(wert))}</b><span>${esc(text)}</span></div>`;
  const leer = (text) => `<p class="muted">${esc(text)}</p>`;

  async function aufsicht() {
    if (!(await verbindung())) {
      $('#bfv-kpis').innerHTML = '';
      ['#bfv-fristen', '#bfv-rb', '#bfv-stellen', '#bfv-lage'].forEach((s) => { $(s).innerHTML = leer('Keine Daten, solange keine Verbindung besteht.'); });
      return;
    }
    const k = await api('GET', 'bfv/kennzahlen');
    $('#bfv-kpis').innerHTML = [
      kpi(k.eingang.offen, 'Offene Aufgaben im BfV', 'var(--brand)'),
      kpi(k.eingang.ueberfaellig, 'Davon zu spät', 'var(--red)'),
      kpi(k.eingang.vomBmi, 'Offene Aufträge vom BMI', 'var(--gold)'),
      kpi(k.rechtsbehelfe.offen, 'Offene Widersprüche', '#7c5cd6'),
      kpi(k.antraege.beimMinister, 'Anträge warten auf Sie', 'var(--red)'),
      kpi(k.gericht.anhaengig, 'Verfahren beim Gericht', '#5b6673')
    ].join('');
    $('#bfv-fristen').innerHTML = k.fristen.length
      ? `<div class="mini">${k.fristen.map((f) => `<div><b>${esc(f.titel)}</b>${f.vomBmi ? ' <span class="bf-tag">vom BMI</span>' : ''}<small>${esc(f.nr)} · ${esc(f.stelle)} · bis ${esc(dateTime(f.frist))}${f.ueberfaellig ? ' · <span class="spaet">zu spät</span>' : ''}</small></div>`).join('')}</div>`
      : leer('Keine Fristen in den nächsten drei Tagen.');
    $('#bfv-rb').innerHTML = k.rechtsbehelfe.liste.length
      ? `<div class="mini">${k.rechtsbehelfe.liste.map((r) => `<div><b>${esc(r.az)}</b> gegen ${esc(r.verfuegung || '–')}<small>${esc(r.gegenstand || '')} · ${esc(r.status)} · seit ${esc(String(r.tageOffen))} Tag(en)</small></div>`).join('')}</div>`
      : leer('Keine offenen Widersprüche.');
    $('#bfv-stellen').innerHTML = k.eingang.stellen.length
      ? `<div class="mini">${k.eingang.stellen.map((s) => `<div class="stelle"><span>${esc(s.name)}</span><b>${esc(String(s.offen))}${s.ueberfaellig ? ` <span class="spaet">(${esc(String(s.ueberfaellig))} zu spät)</span>` : ''}</b></div>`).join('')}</div>`
      : leer('Alles erledigt.');
    $('#bfv-lage').innerHTML = `<div class="mini">${k.lage ? `<div><b>Stufe ${esc(String(k.lage.stufe))}: ${esc(k.lage.stufeName)}</b><small>${esc(k.lage.titel)} · ${esc(dateTime(k.lage.at))}</small></div>` : '<div>Noch keine Lage gemeldet.</div>'}
      <div class="stelle"><span>Offene Fälle</span><b>${esc(String(k.faelle.offen))}</b></div>
      <div class="stelle"><span>Offene Vorgänge</span><b>${esc(String(k.vorgaenge.offen))}</b></div>
      <div class="stelle"><span>Einstufungen in Arbeit</span><b>${esc(String(k.einstufungen.offen))}</b></div>
      <div class="stelle"><span>Presse-Entwürfe beim BfV</span><b>${esc(String(k.presse.entwuerfe))}</b></div></div>
      <p class="muted klein">Stand: ${esc(dateTime(k.stand))}</p>`;
  }
  $('#bfv-neu-laden').addEventListener('click', () => run(aufsicht));

  // --- Erlasse und Verfügungen ----------------------------------------------------

  const form = $('#dok-form');
  function felderZeichnen() {
    const typ = form.typ.value;
    $('#dok-felder').innerHTML = FELDER[typ].map((f) => {
      const attr = `name="f_${f.k}" maxlength="${f.max}"${f.req ? ' required' : ''}`;
      const feld = f.t === 'textarea' ? `<textarea ${attr} rows="${f.rows}"></textarea>` : `<input ${attr}>`;
      return `<label class="field${f.full ? ' full' : ''}">${esc(f.l)}${f.req ? ' *' : ''} <small>${esc(f.h || '')}</small>${feld}</label>`;
    }).join('');
    FELDER[typ].forEach((f) => { if (f.wert) form[`f_${f.k}`].value = f.wert; });
    form.querySelectorAll('[data-nur]').forEach((el) => {
      el.hidden = el.dataset.nur !== typ;
      if (el.hidden) { const cb = el.querySelector('input'); cb.checked = false; $(`#${cb.dataset.zeigt}`).hidden = true; }
    });
    form.nr.value = '';
    form.nr.placeholder = 'wird vorgeschlagen';
    $('#dok-vorschau-link').hidden = true;
  }
  form.typ.addEventListener('change', felderZeichnen);
  form.addEventListener('change', (e) => { if (e.target.dataset.zeigt) $(`#${e.target.dataset.zeigt}`).hidden = !e.target.checked; });

  function dokDaten(fuerVorschau) {
    const typ = form.typ.value;
    const felder = {};
    for (const f of FELDER[typ]) {
      const v = form[`f_${f.k}`].value.trim();
      if (f.req && !v && !fuerVorschau) throw new Error(`Bitte „${f.l}“ ausfüllen.`);
      if (v) felder[f.k] = v;
    }
    if (felder.empfaengerDiscordId && !/^\d{17,20}$/.test(felder.empfaengerDiscordId)) throw new Error('Die Discord-ID besteht nur aus Ziffern (17 bis 20).');
    const daten = { typ, felder, zusatz: form.zusatz.value, nr: form.nr.value.trim() || undefined };
    if (fuerVorschau) return daten;
    daten.oeffentlich = form.oeffentlich.checked;
    if (form.mitAuftrag.checked) {
      if (form.auftrag.value.trim().length < 5) throw new Error('Bitte kurz schreiben, was das BfV tun soll.');
      daten.umsetzung = { auftrag: form.auftrag.value.trim(), frist: form.auftragFrist.value || undefined };
    }
    if (typ === 'verfuegung' && form.mitAkte.checked) {
      daten.personalakte = form.akteNamen.value.split(',').map((n) => n.trim()).filter((n) => n.length >= 3).slice(0, 10);
      if (!daten.personalakte.length) throw new Error('Bitte mindestens einen Namen für die Personalakte angeben.');
    }
    if (form.mitBek.checked) {
      const titel = form.bekTitel.value.trim() || felder.betreff || felder.titel || '';
      const text = form.bekText.value.trim();
      if (titel.length < 5 || text.length < 20) throw new Error('Bekanntmachung: Überschrift (ab 5 Zeichen) und Text (ab 20 Zeichen) ausfüllen.');
      daten.bekanntmachung = { titel, text, sofort: form.bekSofort.checked };
    }
    return daten;
  }

  $('#dok-nr').addEventListener('click', () => run(async () => {
    const r = await api('GET', `bfv/nummer?typ=${form.typ.value === 'erlass' ? 'erlass' : 'verfuegung'}`);
    form.nr.value = r.nr || '';
  }));

  $('#dok-vorschau').addEventListener('click', () => {
    // Fenster sofort öffnen, damit der Browser es nicht als Pop-up blockiert
    const fenster = window.open('', '_blank');
    let ok = false;
    run(async () => {
      const r = await api('POST', 'bfv/vorschau', dokDaten(true));
      const link = $('#dok-vorschau-link');
      link.href = r.ansicht;
      link.hidden = false;
      if (fenster) fenster.location = r.ansicht;
      if (!form.nr.value && r.nr) form.nr.placeholder = `${r.nr} (Vorschlag)`;
      ok = true;
    }).then(() => { if (fenster && !ok) fenster.close(); });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run(async () => {
      const daten = dokDaten(false);
      const name = daten.typ === 'erlass' ? 'Den Erlass' : 'Die Verfügung';
      if (!confirm(`${name} jetzt ausfertigen? Danach gilt sie und kann nur noch aufgehoben werden.`)) return;
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const r = await api('POST', 'bfv/dokument', daten);
        toast(`Ausgefertigt: ${r.dokument.nr}${r.dokument.umsetzung ? ` · Auftrag ${r.dokument.umsetzung.nr} beim BfV` : ''}`);
        form.reset();
        felderZeichnen();
        form.querySelectorAll('.opt').forEach((o) => { o.hidden = true; });
        await dokumente();
      } finally {
        btn.disabled = false;
      }
    });
  });

  let dokCache = [];
  async function dokumente() {
    let r;
    try {
      r = await api('GET', 'bfv/dokumente');
    } catch (err) {
      $('#dok-liste').innerHTML = emptyRow(5, 'Das BfV ist gerade nicht erreichbar.');
      return;
    }
    dokCache = r.dokumente || [];
    $('#dok-liste').innerHTML = dokCache.length ? dokCache.map((d) => {
      const aufgehoben = d.status === 'aufgehoben' || Boolean(d.aufhebung);
      const stand = aufgehoben ? '<span class="bf-tag rot">Aufgehoben</span>'
        : `<span class="bf-tag ok">Gültig</span>${d.oeffentlich ? ' <span class="bf-tag">Öffentlich</span>' : ''}`;
      const extra = [
        d.widersprueche?.length ? `Widersprüche: ${d.widersprueche.length}` : '',
        d.umsetzung ? `Auftrag ${d.umsetzung.nr}` : ''
      ].filter(Boolean).join(' · ');
      return `<tr data-id="${esc(d.id)}">
        <td class="nowrap mono">${esc(d.nr)}</td>
        <td class="title">${esc(d.titel)}<small>${esc(d.typName)}${extra ? ` · ${esc(extra)}` : ''}</small></td>
        <td class="nowrap">${esc(datum(d.datum))}</td>
        <td class="nowrap">${stand}</td>
        <td class="actions"><a class="btn btn-sm" href="/api/bfv/dokument/${encodeURIComponent(d.id)}/ansicht" target="_blank" rel="noopener">Ansehen</a>${aufgehoben ? '' : `
          <button class="btn btn-sm" type="button" data-dok="${d.oeffentlich ? 'zurueckziehen' : 'veroeffentlichen'}">${d.oeffentlich ? 'Nicht mehr öffentlich' : 'Öffentlich machen'}</button>
          <button class="btn btn-sm btn-danger" type="button" data-dok="aufheben">Aufheben</button>`}</td></tr>`;
    }).join('') : emptyRow(5, 'Noch nichts ausgefertigt.');
  }
  $('#dok-neu-laden').addEventListener('click', () => run(dokumente));
  $('#dok-liste').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dok]');
    if (!b) return;
    const d = dokCache.find((x) => x.id === b.closest('[data-id]').dataset.id);
    if (!d) return;
    const aktion = b.dataset.dok;
    let grund;
    if (aktion === 'aufheben') {
      grund = prompt(`${d.nr} aufheben. Warum? (mindestens 5 Zeichen)`);
      if (!grund || grund.trim().length < 5) return;
    }
    run(async () => {
      await api('POST', `bfv/dokument/${encodeURIComponent(d.id)}/aktion`, { aktion, grund });
      toast({ veroeffentlichen: 'Jetzt öffentlich.', zurueckziehen: 'Nicht mehr öffentlich.', aufheben: 'Aufgehoben.' }[aktion]);
      await dokumente();
    });
  });

  // --- Aufträge ans BfV und Bekanntmachungen ---------------------------------------

  let vgCache = [];
  async function vorgaenge() {
    const r = await api('GET', 'bfv/vorgaenge');
    const sel = $('#anfrage-arten');
    if (!sel.options.length) sel.innerHTML = Object.entries(r.arten).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
    vgCache = r.vorgaenge || [];
    $('#vg-liste').innerHTML = vgCache.length ? vgCache.map((v) => {
      const s = v.stand;
      const nrBfv = v.art === 'anfrage' ? v.bfvNr : v.umsetzungNr;
      const antworten = (s?.antworten || []).map((a) => `<li><b>${esc(a.von)}</b> · ${esc(dateTime(a.at))}<br>${esc(a.text)}</li>`).join('');
      const bescheid = s?.bescheid ? `<p class="bescheid"><b>Ergebnis:</b> ${esc(s.bescheid.ergebnis || '')}${s.bescheid.text ? ` · ${esc(s.bescheid.text)}` : ''}</p>` : '';
      const status = s ? `${esc(s.statusName || v.status)}${s.ueberfaellig ? ' <span class="spaet">zu spät</span>' : ''}${s.frist && s.offen ? `<small>bis ${esc(dateTime(s.frist))}</small>` : ''}` : esc(v.status || '');
      return `<tr data-nr="${esc(nrBfv || '')}">
        <td class="nowrap mono">${esc(v.bmiNr)}${nrBfv ? `<small>BfV: ${esc(nrBfv)}</small>` : (v.bfvNr ? `<small>${esc(v.bfvNr)}</small>` : '')}</td>
        <td class="title">${esc(v.titel)}<small>${esc(v.typ)}</small>${antworten || bescheid ? `<details><summary>Nachrichten (${(s?.antworten || []).length})</summary><ul class="antworten">${antworten}</ul>${bescheid}</details>` : ''}</td>
        <td class="nowrap">${esc(dateTime(v.zeit))}</td>
        <td>${status}</td>
        <td class="actions">${nrBfv && s?.offen !== false ? '<button class="btn btn-sm" type="button" data-nachtrag>Nachricht nachschicken</button>' : ''}</td></tr>`;
    }).join('') : emptyRow(5, 'Noch keine Vorgänge mit dem BfV.');
    if (!r.verbunden && vgCache.length) toast('BfV gerade nicht erreichbar, es wird der letzte bekannte Stand gezeigt.', false);
  }
  $('#vg-neu-laden').addEventListener('click', () => run(vorgaenge));
  $('#vg-liste').addEventListener('click', (e) => {
    if (!e.target.closest('[data-nachtrag]')) return;
    const nr = e.target.closest('[data-nr]').dataset.nr;
    const text = prompt(`Nachricht an das BfV zu ${nr}:`);
    if (!text || text.trim().length < 3) return;
    run(async () => { await api('POST', `bfv/anfrage/${encodeURIComponent(nr)}/nachtrag`, { text: text.trim() }); toast('Nachricht gesendet.'); await vorgaenge(); });
  });

  $('#anfrage-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    run(async () => {
      if (f.betreff.value.trim().length < 3 || f.text.value.trim().length < 10) throw new Error('Bitte Betreff und eine kurze Beschreibung (ab 10 Zeichen) ausfüllen.');
      const r = await api('POST', 'bfv/anfrage', { art: f.art.value, betreff: f.betreff.value.trim(), text: f.text.value.trim(), frist: f.frist.value || undefined, prioritaet: f.prioritaet.value });
      toast(`Gesendet: ${r.bmiNr} · beim BfV ${r.eingang.nr}`);
      f.reset();
      await vorgaenge();
    });
  });

  $('#bek-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    run(async () => {
      const r = await api('POST', 'bfv/bekanntmachung', { titel: f.titel.value.trim(), text: f.text.value.trim(), anBfv: f.anBfv.checked, sofort: f.sofort.checked });
      toast(r.beimBfv ? `Bekannt gemacht, beim BfV: ${r.beimBfv === 'entwurf' ? 'Entwurf' : 'veröffentlicht'}.` : 'Bekannt gemacht.');
      f.reset();
      await vorgaenge();
    });
  });

  // --- Laden beim Öffnen eines Bereichs ------------------------------------------------

  felderZeichnen();
  document.addEventListener('admin:tab', (e) => {
    if (e.detail === 'bfv') run(aufsicht);
    if (e.detail === 'erlasse') run(dokumente);
    if (e.detail === 'auftraege') run(vorgaenge);
  });
})();
