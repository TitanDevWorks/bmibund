// Discord-Text für die Verwaltung: Formatknöpfe über Textfeldern und eine Vorschau „So sieht es im Discord aus“.
// Gleiche Bedienung wie im Dienstportal des BfV. Alles wird als DOM gebaut (textContent), nie als HTML:
// eingegebener Text kann kein Skript einschleusen.
(() => {
  const h = (tag, attrs, ...kinder) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const rein = (k) => {
      if (k === null || k === undefined || k === false) return;
      if (Array.isArray(k)) k.forEach(rein);
      else el.append(k instanceof Node ? k : String(k));
    };
    kinder.forEach(rein);
    return el;
  };

  /* ---------- Discord-Markdown lesen (nur das, was Discord auch kann) ---------- */

  const INLINE = [
    ['code', /`([^`\n]+)`/],
    ['link', /\[([^\]\n]+)\]\(<?(https?:\/\/[^\s)>]+)>?\)/],
    ['fett', /\*\*(?!\s)([\s\S]+?)\*\*(?!\*)/],
    ['unter', /__(?!\s)([\s\S]+?)__(?!_)/],
    ['durch', /~~(?!\s)([\s\S]+?)~~/],
    ['spoiler', /\|\|([\s\S]+?)\|\|/],
    ['kursiv', /\*(?![\s*])([\s\S]*?[^\s*])\*(?!\*)/],
    ['kursiv', /(?<![\w_])_(?![\s_])([\s\S]*?[^\s_])_(?![\w_])/],
    ['url', /https?:\/\/[^\s<]+[^\s<.,:;"')\]]/],
    ['erwaehnung', /<(@&|@!?|#)(\d{5,25})>/],
    ['jeder', /@(everyone|here)\b/]
  ];

  // Wer hinter einer ID steckt (aus den gespeicherten Erwähnungen), wird von außen gesetzt.
  let namen = () => null;

  function inline(text) {
    const out = [];
    let rest = String(text ?? '');
    while (rest) {
      let best = null;
      for (const [art, re] of INLINE) {
        const m = re.exec(rest);
        if (m && (!best || m.index < best.m.index)) best = { art, m };
      }
      if (!best) { out.push(rest); break; }
      const { art, m } = best;
      if (m.index) out.push(rest.slice(0, m.index));
      out.push(element(art, m));
      rest = rest.slice(m.index + m[0].length);
    }
    return out;
  }

  function element(art, m) {
    switch (art) {
      case 'code': return h('code', { class: 'dc-code' }, m[1]);
      case 'link': return h('a', { class: 'dc-link', href: m[2], target: '_blank', rel: 'noopener noreferrer' }, inline(m[1]));
      case 'url': return h('a', { class: 'dc-link', href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]);
      case 'fett': return h('strong', null, inline(m[1]));
      case 'unter': return h('u', null, inline(m[1]));
      case 'durch': return h('s', null, inline(m[1]));
      case 'kursiv': return h('em', null, inline(m[1]));
      case 'spoiler': {
        const s = h('span', { class: 'dc-spoiler', tabindex: 0, title: 'Spoiler: zum Aufdecken klicken' }, inline(m[1]));
        const auf = () => s.classList.add('offen');
        s.addEventListener('click', auf);
        s.addEventListener('keydown', (e) => { if (e.key === 'Enter') auf(); });
        return s;
      }
      case 'erwaehnung': {
        if (m[1] === '#') return h('span', { class: 'dc-erwaehnung' }, '#kanal');
        const rolle = m[1] === '@&';
        const name = namen(m[2], rolle);
        return h('span', { class: `dc-erwaehnung${name ? '' : ' unbekannt'}`, title: `ID ${m[2]}` }, `@${name || (rolle ? 'Rolle' : 'Person')}`);
      }
      case 'jeder': return h('span', { class: 'dc-erwaehnung' }, `@${m[1]}`);
    }
    return m[0];
  }

  const LISTE = /^\s*(?:[-*]|\d{1,3}\.) \S/;

  function discordText(text) {
    const zeilen = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let absatz = [];
    const absatzEnde = () => {
      if (!absatz.length) return;
      out.push(h('div', { class: 'dc-zeilen' }, absatz.flatMap((z, i) => (i ? [h('br'), ...inline(z)] : inline(z)))));
      absatz = [];
    };
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      let m;
      if (/^```/.test(z)) {
        absatzEnde();
        const code = [];
        i++;
        while (i < zeilen.length && !/^```/.test(zeilen[i])) code.push(zeilen[i++]);
        out.push(h('pre', { class: 'dc-codeblock' }, code.join('\n')));
        continue;
      }
      if ((m = /^(#{1,3}) (.+)$/.exec(z))) { absatzEnde(); out.push(h(`h${m[1].length + 2}`, { class: `dc-h${m[1].length}` }, inline(m[2]))); continue; }
      if ((m = /^-# (.+)$/.exec(z))) { absatzEnde(); out.push(h('div', { class: 'dc-klein' }, inline(m[1]))); continue; }
      if (/^> /.test(z)) {
        absatzEnde();
        const zit = [];
        while (i < zeilen.length && /^> /.test(zeilen[i])) zit.push(zeilen[i++].slice(2));
        i--;
        out.push(h('blockquote', { class: 'dc-zitat' }, discordText(zit.join('\n'))));
        continue;
      }
      if (LISTE.test(z)) {
        absatzEnde();
        const nummeriert = /^\s*\d/.test(z);
        const start = nummeriert ? parseInt(z, 10) : null;
        const passt = nummeriert ? /^\s*\d{1,3}\. \S/ : /^\s*[-*] \S/;
        const punkte = [];
        while (i < zeilen.length && passt.test(zeilen[i])) {
          punkte.push(h('li', null, inline(zeilen[i].replace(/^\s*(?:[-*]|\d{1,3}\.) /, ''))));
          i++;
        }
        i--;
        out.push(h(nummeriert ? 'ol' : 'ul', { class: 'dc-liste', start: nummeriert && start !== 1 ? start : null }, punkte));
        continue;
      }
      if (z.trim() === '') { absatzEnde(); out.push(h('div', { class: 'dc-leer' })); continue; }
      absatz.push(z);
    }
    absatzEnde();
    while (out[0]?.classList?.contains('dc-leer')) out.shift();
    while (out.at(-1)?.classList?.contains('dc-leer')) out.pop();
    return out;
  }

  /* ---------- Werkzeugleiste ---------- */

  // [Schlüssel, Beschriftung, Erklärung, Art, Zeichen, Tastenkürzel]
  const KNOEPFE = [
    ['fett', 'F', 'Fett', 'um', '**', 'b'],
    ['kursiv', 'K', 'Kursiv (schräg)', 'um', '*', 'i'],
    ['unter', 'U', 'Unterstrichen', 'um', '__', 'u'],
    ['durch', 'S', 'Durchgestrichen', 'um', '~~', null],
    null,
    ['h2', 'Ü', 'Überschrift', 'zeile', '## ', null],
    ['klein', 'klein', 'Kleingedruckt (grau)', 'zeile', '-# ', null],
    null,
    ['liste', '• Liste', 'Aufzählung mit Punkten', 'zeile', '- ', null],
    ['nummer', '1. Liste', 'Nummerierte Aufzählung', 'nummer', null, null],
    ['zitat', '❝ Zitat', 'Zitat (grauer Balken links)', 'zeile', '> ', null],
    null,
    ['link', 'Link', 'Link mit eigenem Text', 'link', null, 'k'],
    ['code', '</>', 'Feste Schrift, z. B. für Aktenzeichen', 'um', '`', null]
  ];

  function einfuegen(ta, start, ende, text, selA, selE) {
    ta.focus();
    ta.setSelectionRange(start, ende);
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (_) { ok = false; }
    if (!ok || ta.value.slice(start, start + text.length) !== text) ta.setRangeText(text, start, ende, 'end');
    ta.setSelectionRange(start + selA, start + selE);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function umschliessen(ta, z) {
    const { selectionStart: a, selectionEnd: e, value: v } = ta;
    const roh = v.slice(a, e);
    const vorn = roh.match(/^\s*/)[0].length;
    const hinten = roh.trim() ? roh.match(/\s*$/)[0].length : 0;
    const s = a + vorn;
    const en = e - hinten;
    const sel = v.slice(s, en);
    if (sel && v.slice(s - z.length, s) === z && v.slice(en, en + z.length) === z) return einfuegen(ta, s - z.length, en + z.length, sel, 0, sel.length);
    if (sel.length > 2 * z.length && sel.startsWith(z) && sel.endsWith(z)) { const innen = sel.slice(z.length, -z.length); return einfuegen(ta, s, en, innen, 0, innen.length); }
    return einfuegen(ta, s, en, z + sel + z, z.length, z.length + sel.length);
  }

  function zeilenBereich(ta) {
    const v = ta.value;
    const a = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    const bis = ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === '\n' ? ta.selectionEnd - 1 : ta.selectionEnd;
    let e = v.indexOf('\n', bis);
    if (e < 0) e = v.length;
    return [a, Math.max(a, e)];
  }

  const PRAEFIX = /^(#{1,3} |-# |> |[-*] |\d{1,3}\. )/;
  function zeilenPraefix(ta, p, nummer = false) {
    const [a, e] = zeilenBereich(ta);
    const zeilen = ta.value.slice(a, e).split('\n');
    const hat = (z) => (nummer ? /^\d{1,3}\. /.test(z) : z.startsWith(p));
    const alle = zeilen.some((z) => z.trim()) && zeilen.every((z) => !z.trim() || hat(z));
    let n = 0;
    const neu = zeilen.map((z) => {
      if (!z.trim() && zeilen.length > 1) return z;
      const ohne = z.replace(PRAEFIX, '');
      return alle ? ohne : (nummer ? `${++n}. ` : p) + ohne;
    }).join('\n');
    einfuegen(ta, a, e, neu, zeilen.length === 1 ? neu.length : 0, neu.length);
  }

  function link(ta) {
    const { selectionStart: a, selectionEnd: e, value: v } = ta;
    const sel = v.slice(a, e).trim();
    if (/^https?:\/\/\S+$/.test(sel)) return einfuegen(ta, a, e, `[Linktext](${sel})`, 1, 9);
    if (sel) { const neu = `[${sel}](https://)`; return einfuegen(ta, a, e, neu, neu.length - 1, neu.length - 1); }
    return einfuegen(ta, a, e, '[Linktext](https://)', 1, 9);
  }

  function ausfuehren(ta, k) {
    const [, , , art, z] = k;
    if (art === 'um') umschliessen(ta, z);
    else if (art === 'zeile') zeilenPraefix(ta, z);
    else if (art === 'nummer') zeilenPraefix(ta, null, true);
    else if (art === 'link') link(ta);
  }

  /** Text an der Cursorstelle einfügen (z. B. eine Erwähnung). */
  function setzen(ta, text) {
    const { selectionStart: a, selectionEnd: e } = ta;
    einfuegen(ta, a, e, text, text.length, text.length);
  }

  /** Werkzeugleiste für ein Textfeld. extra: weitere Knöpfe [{ text, titel, klick(ta, knopf) }]. */
  function werkzeugleiste(ta, extra = []) {
    const leiste = h('div', { class: 'dc-leiste', role: 'toolbar', 'aria-label': 'Text formatieren' });
    const knopf = (text, titel, cls, tun) => {
      const b = h('button', { type: 'button', class: `dc-knopf ${cls}`, title: titel, 'aria-label': titel }, text);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => tun(b));
      leiste.append(b);
    };
    for (const k of KNOEPFE) {
      if (!k) { leiste.append(h('span', { class: 'dc-trenner', 'aria-hidden': 'true' })); continue; }
      const [key, text, titel, , , kurz] = k;
      knopf(text, `${titel}${kurz ? ` (Strg+${kurz.toUpperCase()})` : ''}`, `dc-k-${key}`, () => ausfuehren(ta, k));
    }
    if (extra.length) leiste.append(h('span', { class: 'dc-trenner', 'aria-hidden': 'true' }));
    extra.forEach((x) => knopf(x.text, x.titel, `dc-k-extra ${x.cls || ''}`, (b) => x.klick(ta, b)));
    ta.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = KNOEPFE.find((x) => x && x[5] === e.key.toLowerCase());
      if (k) { e.preventDefault(); ausfuehren(ta, k); }
    });
    return leiste;
  }

  window.BMIH_DISCORD = {
    h,
    inline,
    discordText,
    werkzeugleiste,
    setzen,
    namenAufloesen: (fn) => { namen = fn; }
  };
})();
