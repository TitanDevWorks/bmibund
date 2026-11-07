// Verwaltung: „Presse für Discord“. Pressemitteilungen und „BfV Informationen“ aus Vorlagen schreiben,
// Rollen und Personen per Auswahl erwähnen, Live-Vorschau wie im Discord, Text kopieren und posten.
// Entwürfe und gespeicherte Erwähnungen liegen in der BMI-API (/api/pressestatements, /api/erwaehnungen).
// Eingaben landen nur über textContent/value im DOM, nie als HTML.
(() => {
  const A = window.BMIH_ADMIN;
  const D = window.BMIH_DISCORD;
  if (!A || !D) return;
  const B = window.BMIH;
  const { h } = D;
  const { api, toast, run } = A;
  const $ = (s, root = document) => root.querySelector(s);

  const GRENZE = 2000; // So viele Zeichen erlaubt Discord in einer normalen Nachricht
  const ID_RE = /^\d{15,22}$/;
  const SPEICHER = 'bmih-admin-pd-entwurf';
  const langDatum = (iso) => new Date(`${iso || B.today()}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  const kurzDatum = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : '');

  /* ---------- Vorlagen (nach den Mustern der Hausleitung vom 07.11.2026) ---------- */

  const ABS1 = 'Bundesministerium des Innern und für Heimat';
  const ABS2 = 'Zuständig für das Bundesamt für Verfassungsschutz (BfV)';
  const VORLAGEN = [
    {
      key: 'pm', name: 'Pressemitteilung', art: 'Pressemitteilung', kopf: 'PRESSEMITTEILUNG', ping: true, kanal: 'pressemitteilungen',
      info: 'Für Neuigkeiten an alle. Mit Rollen-Ping und Betreff.',
      betreff: '',
      bloecke: () => [{ typ: 'text', text: 'Sehr geehrte Damen und Herren,\n\n' }]
    },
    {
      key: 'pm-personal', name: 'Pressemitteilung: Personalien', art: 'Pressemitteilung', kopf: 'PRESSEMITTEILUNG', ping: true, kanal: 'pressemitteilungen',
      info: 'Wer bekommt welches Amt? Mit Liste: Amt, Name, Partei.',
      betreff: 'Neue Leitung des Bundesamtes für Verfassungsschutz bestellt',
      bloecke: () => [
        { typ: 'text', text: `Sehr geehrte Damen und Herren,\n\nam heutigen ${langDatum()} wurden folgende Personen mit sofortiger Wirkung mit den genannten Leitungsfunktionen beim Bundesamt für Verfassungsschutz betraut:` },
        { typ: 'personen', zeilen: [{ funktion: 'Präsident', name: '', partei: 'parteilos' }, { funktion: 'Vizepräsident', name: '', partei: 'parteilos' }] },
        { typ: 'text', text: 'Die Neubesetzung erfolgt im Rahmen der organisatorischen Neuausrichtung des Verfassungsschutzes. Die neue Leitung übernimmt die Verantwortung für eine geordnete Aufgabenverteilung, verlässliche Arbeitsabläufe und die gewissenhafte Erfüllung des gesetzlichen Auftrags.' }
      ]
    },
    {
      key: 'bfv-verfuegungen', name: 'BfV Informationen: Verfügungen', art: 'BfV Informationen', kopf: 'BfV INFORMATIONEN', ping: false, kanal: 'bfv-informationen',
      info: 'Verfügungen veröffentlichen. Mit Liste: Aktenzeichen und Person.',
      betreff: '',
      bloecke: () => [
        { typ: 'text', text: `Hier werden die Personalverfügungen vom ${langDatum()} zur … veröffentlicht.` },
        { typ: 'dokumente', titel: 'Zuordnung der Dokumente', zeilen: [{ az: 'Z-0__-2026', text: 'Name, Amt' }] },
        { typ: 'text', text: 'Die Bestellungen gelten mit sofortiger Wirkung. Den genannten Personen wird die Wahrnehmung der mit ihren jeweiligen Funktionen verbundenen Aufgaben und Verantwortlichkeiten übertragen.' }
      ]
    },
    {
      key: 'bfv-erlass', name: 'BfV Informationen: Erlass', art: 'BfV Informationen', kopf: 'BfV INFORMATIONEN', ping: false, kanal: 'bfv-informationen',
      info: 'Einen Erlass bekannt machen. Mit Abschnitten wie „Fristen“.',
      betreff: '',
      bloecke: () => [
        { typ: 'text', text: `Hier wird der Erlass vom ${langDatum()} über … veröffentlicht.` },
        { typ: 'dokumente', titel: 'Dokument', zeilen: [{ az: 'D 1 – 00_/2026', text: 'Erlass über …' }] },
        { typ: 'abschnitt', titel: 'Was bedeutet das für euch?', text: '' },
        { typ: 'text', text: 'Der Erlass tritt mit Bekanntgabe in Kraft.' }
      ]
    },
    {
      key: 'frei', name: 'Freie Mitteilung', art: 'Mitteilung', kopf: 'MITTEILUNG', ping: false, kanal: 'ankuendigungen',
      info: 'Leeres Blatt mit Kopf und Unterschrift.',
      betreff: '',
      bloecke: () => [{ typ: 'text', text: '' }]
    }
  ];
  const vorlageVon = (key) => VORLAGEN.find((v) => v.key === key) || VORLAGEN[0];

  const BAUSTEINE = {
    text: { name: 'Text', neu: () => ({ typ: 'text', text: '' }) },
    abschnitt: { name: 'Abschnitt mit Überschrift', neu: () => ({ typ: 'abschnitt', titel: '', text: '' }) },
    personen: { name: 'Personenliste', neu: () => ({ typ: 'personen', zeilen: [{ funktion: '', name: '', partei: '' }] }) },
    dokumente: { name: 'Dokumentenliste', neu: () => ({ typ: 'dokumente', titel: 'Dokumente', zeilen: [{ az: '', text: '' }] }) }
  };

  /* ---------- Zustand ---------- */

  let erwaehnungen = [];
  let statements = [];
  let geladen = false;
  let aktuell = null; // ID des geöffneten gespeicherten Statements
  let vorlage = VORLAGEN[0];
  let bloecke = [];
  let geaendert = false;

  const form = $('#pd-form');
  if (!form) return;
  const f = form.elements;

  D.namenAufloesen((id, rolle) => {
    const e = erwaehnungen.find((x) => x.discordId === id && (x.art === 'Rolle') === rolle);
    return e ? e.titel : null;
  });

  /* ---------- Auswahl Rolle / Person ---------- */

  function auswahlFuellen(select, art, leer) {
    const alt = auswahlId(select);
    select.replaceChildren(
      h('option', { value: '' }, leer),
      ...erwaehnungen.filter((e) => e.art === art).map((e) => h('option', { value: e.discordId }, `${art === 'Rolle' ? '@' : ''}${e.titel}`)),
      h('option', { value: '__andere' }, 'Andere ID eingeben …')
    );
    setzeAuswahl(select, alt);
  }

  function setzeAuswahl(select, id) {
    const eingabe = $(`#${select.id}-id`);
    if (!id) { select.value = ''; eingabe.value = ''; }
    else if (id === '__andere') select.value = '__andere';
    else if ([...select.options].some((o) => o.value === id)) { select.value = id; eingabe.value = ''; }
    else { select.value = '__andere'; eingabe.value = id; }
    eingabe.hidden = select.value !== '__andere';
  }

  function auswahlId(select) {
    if (select.value !== '__andere') return select.value;
    return $(`#${select.id}-id`).value.replace(/\D/g, '');
  }

  /* ---------- Text bauen ---------- */

  function zustand() {
    return {
      vorlage: vorlage.key,
      kopf: f.kopf.value.trim(),
      rolle: auswahlId(f.rolle),
      absender1: f.absender1.value.trim(),
      absender2: f.absender2.value.trim(),
      betreff: f.betreff.value.trim(),
      person: auswahlId(f.person),
      funktion: f.funktion.value.trim(),
      datum: f.datum.value || B.today(),
      bloecke: JSON.parse(JSON.stringify(bloecke))
    };
  }

  const ueber = (t) => (t ? `**${/[?!:]$/.test(t) ? t : `${t}:`}**` : '');

  function blockText(b) {
    if (b.typ === 'text') return String(b.text || '').replace(/^\n+/, '').trimEnd();
    if (b.typ === 'abschnitt') return [ueber(String(b.titel || '').trim()), String(b.text || '').trim()].filter(Boolean).join('\n');
    if (b.typ === 'personen') {
      return (b.zeilen || []).filter((z) => z.name.trim() || z.funktion.trim()).map((z) => {
        const name = z.name.trim() || '…';
        const partei = z.partei.trim() ? ` (${z.partei.trim()})` : '';
        return z.funktion.trim() ? `- **${z.funktion.trim()}:** ${name}${partei}` : `- ${name}${partei}`;
      }).join('\n');
    }
    if (b.typ === 'dokumente') {
      const zeilen = (b.zeilen || []).filter((z) => z.az.trim() || z.text.trim()).map((z) => [z.az.trim(), z.text.trim()].filter(Boolean).join(' – '));
      return [ueber(String(b.titel || '').trim()), ...zeilen].filter(Boolean).join('\n');
    }
    return '';
  }

  function discordNachricht(z = zustand()) {
    const kopf = [];
    if (z.kopf) kopf.push(`**${z.kopf}**`);
    if (ID_RE.test(z.rolle)) kopf.push(`<@&${z.rolle}>`);
    if (z.absender1) kopf.push(`**${z.absender1}**`);
    if (z.absender2) kopf.push(`**${z.absender2}**`);
    const teile = [kopf.join('\n')];
    if (z.betreff) teile.push(`**Betreff: ${z.betreff}**`);
    z.bloecke.map(blockText).filter((t) => t.trim()).forEach((t) => teile.push(t));
    const fuss = [];
    if (ID_RE.test(z.person)) fuss.push(`<@${z.person}>`);
    if (z.funktion) fuss.push(z.funktion);
    if (fuss.length) teile.push(fuss.join('\n'));
    return teile.filter((t) => t.trim()).join('\n\n');
  }

  const nameVon = (id, rolle) => erwaehnungen.find((e) => e.discordId === id && (e.art === 'Rolle') === rolle)?.titel || '';

  // Fassung für die Webseite: ohne Discord-Zeichen, Erwähnungen als Namen
  function webText(z = zustand()) {
    const teile = z.bloecke.map(blockText).filter((t) => t.trim());
    const unter = [nameVon(z.person, false), z.funktion].filter(Boolean).join('\n');
    if (unter) teile.push(unter);
    return teile.join('\n\n')
      .replace(/<@&(\d+)>/g, (_, id) => nameVon(id, true))
      .replace(/<@!?(\d+)>/g, (_, id) => nameVon(id, false))
      .replace(/<#\d+>/g, '')
      .replace(/@(everyone|here)\b/g, '')
      .replace(/\*\*|__|~~|\|\||`/g, '')
      .replace(/(^|\s)\*(\S[^*\n]*?)\*/g, '$1$2')
      .replace(/^(#{1,3}|-#|>) /gm, '')
      .replace(/^\s*[-*] /gm, '• ')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)')
      .slice(0, 6000);
  }

  /* ---------- Bausteine darstellen ---------- */

  const erwaehnenKnopf = {
    text: '@ Erwähnen', titel: 'Rolle oder Person erwähnen', cls: 'dc-k-at',
    klick: (ta, knopf) => erwaehnenMenue(knopf, (text) => D.setzen(ta, text))
  };
  const datumKnopf = { text: 'Datum', titel: 'Heutiges Datum einfügen', cls: 'dc-k-datum', klick: (ta) => D.setzen(ta, langDatum()) };

  function textfeld(wert, rows, setze, ph) {
    const ta = h('textarea', { rows, maxlength: 4000, placeholder: ph || 'Hier schreiben …', class: 'dc-feld' });
    ta.value = wert || '';
    ta.addEventListener('input', () => { setze(ta.value); neu(); });
    return h('div', { class: 'dc-editor' }, D.werkzeugleiste(ta, [erwaehnenKnopf, datumKnopf]), ta);
  }

  function eingabe(wert, ph, setze, cls) {
    const i = h('input', { placeholder: ph, maxlength: 300, class: cls || null, 'aria-label': ph });
    i.value = wert || '';
    i.addEventListener('input', () => { setze(i.value); neu(); });
    return i;
  }

  function steuerung(i) {
    const k = (text, titel, tun, aus) => {
      const b = h('button', { type: 'button', class: 'pd-mini', title: titel, 'aria-label': titel, disabled: aus || null }, text);
      b.addEventListener('click', tun);
      return b;
    };
    return h('span', { class: 'pd-steuer' },
      k('↑', 'Nach oben', () => schieben(i, -1), i === 0),
      k('↓', 'Nach unten', () => schieben(i, 1), i === bloecke.length - 1),
      k('✕', 'Baustein entfernen', () => { bloecke.splice(i, 1); bausteineZeigen(); neu(); }));
  }

  function schieben(i, d) {
    const j = i + d;
    if (j < 0 || j >= bloecke.length) return;
    [bloecke[i], bloecke[j]] = [bloecke[j], bloecke[i]];
    bausteineZeigen();
    neu();
  }

  function zeilenListe(b, spalten, leer) {
    const tabelle = h('div', { class: 'pd-zeilen' });
    b.zeilen.forEach((z, zi) => {
      const zeile = h('div', { class: `pd-zeile pd-sp-${spalten.length}` }, spalten.map(([k, ph, cls]) => eingabe(z[k], ph, (v) => { z[k] = v; }, cls)));
      const weg = h('button', { type: 'button', class: 'pd-mini', title: 'Zeile entfernen', 'aria-label': 'Zeile entfernen' }, '✕');
      weg.addEventListener('click', () => { b.zeilen.splice(zi, 1); if (!b.zeilen.length) b.zeilen.push(leer()); bausteineZeigen(); neu(); });
      zeile.append(weg);
      tabelle.append(zeile);
    });
    const plus = h('button', { type: 'button', class: 'btn btn-sm pd-plus' }, '+ Zeile');
    plus.addEventListener('click', () => {
      b.zeilen.push(leer());
      const nr = bloecke.indexOf(b);
      bausteineZeigen();
      neu();
      $(`#pd-bloecke .pd-block:nth-child(${nr + 1}) .pd-zeile:last-child input`)?.focus();
    });
    return [tabelle, plus];
  }

  function bausteineZeigen() {
    const box = $('#pd-bloecke');
    box.replaceChildren(...bloecke.map((b, i) => {
      const kopf = h('div', { class: 'pd-block-kopf' }, h('span', { class: 'pd-block-nr' }, String(i + 1)), h('b', null, BAUSTEINE[b.typ].name), steuerung(i));
      let inhalt = [];
      if (b.typ === 'text') inhalt = [textfeld(b.text, 5, (v) => { b.text = v; })];
      else if (b.typ === 'abschnitt') {
        inhalt = [eingabe(b.titel, 'Überschrift, z. B. Fristen', (v) => { b.titel = v; }, 'pd-titel'), textfeld(b.text, 4, (v) => { b.text = v; })];
      } else if (b.typ === 'personen') {
        inhalt = [h('p', { class: 'pd-hilfe' }, 'Eine Zeile pro Person. Im Discord steht dann: • Amt: Name (Partei)'),
          ...zeilenListe(b, [['funktion', 'Amt, z. B. Präsident'], ['name', 'Name'], ['partei', 'Partei (optional)', 'pd-klein']], () => ({ funktion: '', name: '', partei: '' }))];
      } else if (b.typ === 'dokumente') {
        inhalt = [eingabe(b.titel, 'Überschrift, z. B. Zuordnung der Dokumente', (v) => { b.titel = v; }, 'pd-titel'),
          h('p', { class: 'pd-hilfe' }, 'Eine Zeile pro Dokument. Im Discord steht dann: Aktenzeichen – Beschreibung'),
          ...zeilenListe(b, [['az', 'Aktenzeichen', 'pd-az'], ['text', 'Wer oder was?']], () => ({ az: '', text: '' }))];
      }
      return h('section', { class: `pd-block pd-block-${b.typ}`, 'aria-label': `Baustein ${i + 1}: ${BAUSTEINE[b.typ].name}` }, kopf, ...inhalt);
    }));
    if (!bloecke.length) box.append(h('p', { class: 'pd-leer' }, 'Noch keine Bausteine. Füge unten einen hinzu.'));
  }

  /* ---------- Erwähnen-Menü ---------- */

  let menue = null;
  function menueZu() { menue?.remove(); menue = null; }
  function erwaehnenMenue(knopf, einsetzen) {
    if (menue) { menueZu(); return; }
    const eintrag = (text, sub, tun) => {
      const b = h('button', { type: 'button', role: 'menuitem' }, h('span', null, text), sub ? h('small', null, sub) : null);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { tun(); menueZu(); });
      return b;
    };
    const rollen = erwaehnungen.filter((e) => e.art === 'Rolle');
    const personen = erwaehnungen.filter((e) => e.art === 'Person');
    menue = h('div', { class: 'pd-menue', role: 'menu' },
      rollen.length ? h('span', { class: 'pd-menue-gr' }, 'Rollen') : null,
      rollen.map((e) => eintrag(`@${e.titel}`, e.zusatz, () => einsetzen(`<@&${e.discordId}>`))),
      personen.length ? h('span', { class: 'pd-menue-gr' }, 'Personen') : null,
      personen.map((e) => eintrag(`@${e.titel}`, e.zusatz, () => einsetzen(`<@${e.discordId}>`))),
      h('span', { class: 'pd-menue-gr' }, 'Sonstiges'),
      eintrag('@everyone', 'alle auf dem Server', () => einsetzen('@everyone')),
      eintrag('Rollen und Personen verwalten …', 'unten auf dieser Seite', () => $('#pd-erw-form [name=titel]').focus()));
    document.body.append(menue);
    const r = knopf.getBoundingClientRect();
    menue.style.top = `${r.bottom + scrollY + 6}px`;
    menue.style.left = `${Math.max(12, Math.min(r.left + scrollX, innerWidth - menue.offsetWidth - 12))}px`;
    menue.querySelector('button')?.focus();
  }
  document.addEventListener('mousedown', (e) => { if (menue && !e.target.closest('.pd-menue, .dc-k-at')) menueZu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menueZu(); });

  /* ---------- Vorschau ---------- */

  const UHR = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  let geplant = 0;
  function neu() {
    geaendert = true;
    if (!geplant) geplant = requestAnimationFrame(zeichnen);
  }

  function zeichnen() {
    geplant = 0;
    const z = zustand();
    const text = discordNachricht(z);
    $('#pd-roh').value = text;
    const person = erwaehnungen.find((e) => e.art === 'Person' && e.discordId === z.person);
    const name = person ? person.titel : 'Hausleitung BMI';
    const avatar = person && person.discordId === '1431459469472301160'
      ? h('img', { class: 'dc-avatar', src: 'assets/img/minister-fiedel-av.webp', alt: '', width: 40, height: 40 })
      : h('span', { class: 'dc-avatar pd-initial', 'aria-hidden': 'true' }, (name.match(/[A-ZÄÖÜ]/g) || ['B']).slice(-1)[0]);
    $('#pd-chat').replaceChildren(h('div', { class: 'dc-chat' },
      h('div', { class: 'dc-kanal' }, h('span', { class: 'dc-raute', 'aria-hidden': 'true' }, '#'), vorlage.kanal),
      h('div', { class: 'dc-nachricht' }, avatar,
        h('div', { class: 'dc-rumpf' },
          h('div', { class: 'dc-kopfzeile' }, h('b', null, name), h('span', { class: 'dc-zeit' }, `Heute um ${UHR.format(new Date())}`)),
          h('div', { class: 'dc-text' }, text.trim() ? D.discordText(text) : h('span', { class: 'dc-platzhalter' }, 'Hier erscheint dein Text …'))))));

    // Zähler und Hinweise
    const n = text.length;
    const zaehler = $('#pd-zaehler');
    zaehler.textContent = `${n} / ${GRENZE} Zeichen`;
    zaehler.classList.toggle('zu-lang', n > GRENZE);
    $('#pd-balken').style.setProperty('--p', `${Math.min(100, (n / GRENZE) * 100)}%`);
    $('#pd-balken').classList.toggle('zu-lang', n > GRENZE);
    const hinweise = [];
    if (n > GRENZE) hinweise.push(`Zu lang für eine Discord-Nachricht. Bitte um ${n - GRENZE} Zeichen kürzen oder in zwei Nachrichten teilen.`);
    if (f.rolle.value === '__andere' && !ID_RE.test(z.rolle)) hinweise.push('Die Rollen-ID ist ungültig (nur Ziffern, 15 bis 22 Stellen). Der Ping fehlt deshalb.');
    if (f.person.value === '__andere' && !ID_RE.test(z.person)) hinweise.push('Die ID für die Unterschrift ist ungültig. Die Erwähnung fehlt deshalb.');
    if (/…|_{2,}|0_/.test(text)) hinweise.push('Im Text stehen noch Platzhalter (… oder _). Bitte ausfüllen.');
    $('#pd-hinweise').replaceChildren(...hinweise.map((t) => h('li', null, t)));
    $('#pd-hinweise').hidden = !hinweise.length;
    const s = statements.find((x) => x.id === aktuell);
    $('#pd-stand').textContent = s
      ? `${s.stand || 'Entwurf'}${geaendert ? ' · ungespeicherte Änderungen' : ' · gespeichert'}`
      : (geaendert ? 'Noch nicht gespeichert' : 'Neu');
    try { localStorage.setItem(SPEICHER, JSON.stringify({ aktuell, z })); } catch (_) { /* egal */ }
  }

  /* ---------- Laden / Füllen ---------- */

  function vorlagenZeigen() {
    $('#pd-vorlagen').replaceChildren(...VORLAGEN.map((v) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(v.key === vorlage.key), class: 'pd-vorlage', 'data-art': v.art },
        h('span', { class: 'pd-v-kopf' }, v.kopf), h('b', null, v.name), h('small', null, v.info));
      b.addEventListener('click', () => {
        if (v.key === vorlage.key && !geaendert) return;
        if (geaendert && !confirm('Neue Vorlage laden? Ungespeicherte Änderungen gehen verloren.')) return;
        vorlageLaden(v);
        listeZeigen();
      });
      return b;
    }));
  }

  function standardPerson() {
    return erwaehnungen.find((e) => e.art === 'Person' && e.discordId === '1431459469472301160') || erwaehnungen.find((e) => e.art === 'Person');
  }

  function vorlageLaden(v) {
    aktuell = null;
    vorlage = v;
    const person = standardPerson();
    fuellen({
      vorlage: v.key,
      kopf: v.kopf,
      rolle: v.ping ? (erwaehnungen.find((e) => e.art === 'Rolle')?.discordId || '') : '',
      absender1: ABS1,
      absender2: ABS2,
      betreff: v.betreff,
      person: person?.discordId || '',
      funktion: person?.zusatz || 'Bundesminister des Innern und für Heimat',
      datum: B.today(),
      bloecke: v.bloecke()
    });
    geaendert = false;
    zeichnen();
  }

  function fuellen(z) {
    vorlage = vorlageVon(z.vorlage || vorlage.key);
    f.kopf.value = z.kopf || '';
    setzeAuswahl(f.rolle, z.rolle || '');
    f.absender1.value = z.absender1 || '';
    f.absender2.value = z.absender2 || '';
    f.betreff.value = z.betreff || '';
    setzeAuswahl(f.person, z.person || '');
    f.funktion.value = z.funktion || '';
    f.datum.value = z.datum || B.today();
    bloecke = Array.isArray(z.bloecke) ? z.bloecke.filter((b) => b && BAUSTEINE[b.typ]) : [];
    bloecke.forEach((b) => { if ((b.typ === 'personen' || b.typ === 'dokumente') && !Array.isArray(b.zeilen)) b.zeilen = [BAUSTEINE[b.typ].neu().zeilen[0]]; });
    vorlagenZeigen();
    bausteineZeigen();
  }

  async function laden() {
    [erwaehnungen, statements] = await Promise.all([api('GET', 'erwaehnungen'), api('GET', 'pressestatements')]);
    auswahlFuellen(f.rolle, 'Rolle', 'Niemanden anpingen');
    auswahlFuellen(f.person, 'Person', 'Ohne Erwähnung');
    erwaehnungenZeigen();
    if (!geladen) {
      geladen = true;
      let alt = null;
      try { alt = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch (_) { alt = null; }
      if (alt?.z && Array.isArray(alt.z.bloecke)) {
        aktuell = statements.some((s) => s.id === alt.aktuell) ? alt.aktuell : null;
        fuellen(alt.z);
        geaendert = false;
        zeichnen();
      } else vorlageLaden(VORLAGEN[0]);
    } else zeichnen();
    listeZeigen();
  }

  /* ---------- Gespeicherte Statements ---------- */

  function listeZeigen() {
    const tb = $('#pd-liste');
    const liste = [...statements].sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));
    if (!liste.length) { tb.replaceChildren(h('tr', { class: 'empty-row' }, h('td', { colspan: 5 }, 'Noch nichts gespeichert.'))); return; }
    tb.replaceChildren(...liste.map((s) => {
      const knopf = (text, tun, cls) => { const b = h('button', { type: 'button', class: `btn btn-sm ${cls || ''}` }, text); b.addEventListener('click', tun); return b; };
      return h('tr', { class: s.id === aktuell ? 'pd-offen' : null },
        h('td', { class: 'nowrap' }, kurzDatum(s.datum)),
        h('td', null, h('span', { class: `tag ${s.art === 'Pressemitteilung' ? 'blau' : ''}` }, s.art)),
        h('td', { class: 'title' }, s.titel, s.meldung ? h('small', null, 'auch auf der Webseite') : null),
        h('td', null, h('span', { class: `tag ${s.stand === 'Gepostet' ? 'ok' : 'draft'}` }, s.stand === 'Gepostet' ? `Gepostet${s.gepostetAm ? ` ${kurzDatum(s.gepostetAm)}` : ''}` : 'Entwurf')),
        h('td', { class: 'actions' },
          knopf('Öffnen', () => oeffnen(s, false)),
          knopf('Als Vorlage', () => oeffnen(s, true)),
          knopf('Löschen', () => run(async () => {
            if (!confirm(`„${s.titel}“ löschen?`)) return;
            await api('DELETE', `pressestatements/${encodeURIComponent(s.id)}`);
            if (aktuell === s.id) aktuell = null;
            statements = statements.filter((x) => x.id !== s.id);
            listeZeigen();
            zeichnen();
            toast('Gelöscht.');
          }), 'btn-danger')));
    }));
  }

  function oeffnen(s, alsKopie) {
    if (geaendert && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    let z = null;
    try { z = JSON.parse(s.felder || 'null'); } catch (_) { z = null; }
    if (!z) { toast('Dieser Eintrag hat keine Felder zum Bearbeiten.', false); return; }
    if (alsKopie) z.datum = B.today();
    aktuell = alsKopie ? null : s.id;
    fuellen({ ...z, vorlage: s.vorlage || z.vorlage });
    geaendert = alsKopie;
    zeichnen();
    listeZeigen();
    $('#pd-vorlagen').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(alsKopie ? 'Als neue Vorlage geöffnet. Speichern legt einen neuen Eintrag an.' : 'Geöffnet.');
  }

  function titelVon(z) {
    if (z.betreff) return z.betreff.slice(0, 200);
    const erster = z.bloecke.map(blockText).find((t) => t.trim()) || vorlage.name;
    return erster.replace(/<[@#][!&]?\d+>/g, '').replace(/[*_~`|>#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || vorlage.name;
  }

  async function speichern(extra = {}) {
    const z = zustand();
    const body = { titel: titelVon(z), art: vorlage.art, vorlage: vorlage.key, datum: z.datum, text: discordNachricht(z).slice(0, 6000), felder: JSON.stringify(z), ...extra };
    const item = aktuell
      ? await api('PUT', `pressestatements/${encodeURIComponent(aktuell)}`, body)
      : await api('POST', 'pressestatements', body);
    aktuell = item.id;
    statements = [...statements.filter((s) => s.id !== item.id), item];
    geaendert = false;
    listeZeigen();
    zeichnen();
    return item;
  }

  /* ---------- Erwähnungen verwalten ---------- */

  function erwaehnungenZeigen() {
    const box = $('#pd-erw-liste');
    if (!erwaehnungen.length) { box.replaceChildren(h('p', { class: 'pd-leer' }, 'Noch keine Rollen oder Personen gespeichert.')); return; }
    box.replaceChildren(...['Rolle', 'Person'].flatMap((art) => erwaehnungen.filter((e) => e.art === art).map((e) => {
      const weg = h('button', { type: 'button', class: 'pd-mini', title: 'Entfernen', 'aria-label': `${e.titel} entfernen` }, '✕');
      weg.addEventListener('click', () => run(async () => {
        if (!confirm(`„${e.titel}“ aus der Liste entfernen?`)) return;
        await api('DELETE', `erwaehnungen/${encodeURIComponent(e.id)}`);
        await laden();
        toast('Entfernt.');
      }));
      return h('div', { class: 'pd-erw' },
        h('span', { class: `pd-erw-art ${art === 'Rolle' ? 'rolle' : 'person'}`, title: art }, art === 'Rolle' ? '@&' : '@'),
        h('span', { class: 'pd-erw-name' }, h('b', null, e.titel), e.zusatz ? h('small', null, e.zusatz) : null),
        h('code', null, e.discordId),
        weg);
    })));
  }

  $('#pd-erw-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const ef = e.currentTarget;
    const id = ef.discordId.value.replace(/\D/g, '');
    if (!ef.titel.value.trim()) { toast('Bitte einen Namen eintragen.', false); ef.titel.focus(); return; }
    if (!ID_RE.test(id)) { toast('Die ID besteht nur aus Ziffern (15 bis 22 Stellen).', false); ef.discordId.focus(); return; }
    run(async () => {
      await api('POST', 'erwaehnungen', { titel: ef.titel.value.trim(), art: ef.art.value, discordId: id, zusatz: ef.zusatz.value.trim() || undefined });
      ef.reset();
      await laden();
      toast('Gespeichert. Jetzt in der Auswahl und unter „@ Erwähnen“.');
    });
  });
  // „<@&123…>“ aus Discord einfügen geht auch: nur die Ziffern bleiben übrig, die Art wird erkannt
  $('#pd-erw-form [name=discordId]').addEventListener('input', (e) => {
    const t = e.target.value;
    if (/<@&\d/.test(t)) $('#pd-erw-form [name=art]').value = 'Rolle';
    else if (/<@!?\d/.test(t)) $('#pd-erw-form [name=art]').value = 'Person';
    if (/\D/.test(t)) e.target.value = t.replace(/\D/g, '');
  });

  /* ---------- Ereignisse ---------- */

  form.addEventListener('input', (e) => { if (e.target.closest('#pd-kopf, #pd-fuss')) neu(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  for (const sel of [f.rolle, f.person]) {
    sel.addEventListener('change', () => {
      setzeAuswahl(sel, sel.value);
      if (sel.value === '__andere') $(`#${sel.id}-id`).focus();
      if (sel === f.person) {
        const p = erwaehnungen.find((x) => x.art === 'Person' && x.discordId === sel.value);
        if (p?.zusatz) f.funktion.value = p.zusatz;
      }
      neu();
    });
  }

  $('#pd-add').addEventListener('click', (e) => {
    const b = e.target.closest('[data-baustein]');
    if (!b) return;
    bloecke.push(BAUSTEINE[b.dataset.baustein].neu());
    bausteineZeigen();
    neu();
    $('#pd-bloecke .pd-block:last-child')?.querySelector('textarea, input')?.focus();
  });

  async function kopieren() {
    const text = $('#pd-roh').value;
    if (!text.trim()) { toast('Es gibt noch keinen Text.', false); return; }
    if (text.length > GRENZE && !confirm(`Der Text ist ${text.length} Zeichen lang, Discord erlaubt ${GRENZE}. Trotzdem kopieren?`)) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const roh = $('#pd-roh');
      $('#pd-roh-box').open = true;
      roh.focus();
      roh.select();
      if (!document.execCommand('copy')) { toast('Kopieren nicht möglich. Der Text ist markiert: Strg+C drücken.', false); return; }
    }
    toast('Kopiert. Jetzt im Discord-Kanal einfügen (Strg+V) und abschicken.');
  }

  $('#pd-kopieren').addEventListener('click', () => run(kopieren));
  $('#pd-speichern').addEventListener('click', () => run(async () => { await speichern(); toast('Entwurf gespeichert.'); }));
  $('#pd-gepostet').addEventListener('click', () => run(async () => {
    await speichern({ stand: 'Gepostet', gepostetAm: B.today() });
    toast('Als gepostet vermerkt.');
  }));
  $('#pd-web').addEventListener('click', () => run(async () => {
    const z = zustand();
    const text = webText(z);
    if (!text.trim()) { toast('Es gibt noch keinen Text.', false); return; }
    const meldung = await api('POST', 'meldungen', {
      titel: titelVon(z),
      datum: z.datum,
      kategorie: vorlage.art === 'Pressemitteilung' ? 'Pressemitteilung' : 'Bekanntmachung',
      status: 'Entwurf',
      text
    });
    await speichern({ meldung: meldung.id });
    await A.refresh('meldungen');
    A.go('meldungen');
    A.openEditor('meldungen', A.data.meldungen.find((m) => m.id === meldung.id) || meldung);
    toast('Als Entwurf unter „Presse“ angelegt. Prüfen und auf „Veröffentlicht“ stellen.');
  }));
  $('#pd-neu').addEventListener('click', () => {
    if (geaendert && !confirm('Neu anfangen? Ungespeicherte Änderungen gehen verloren.')) return;
    vorlageLaden(vorlage);
    listeZeigen();
  });

  document.addEventListener('admin:tab', (e) => { if (e.detail === 'discord') run(laden); });
})();
