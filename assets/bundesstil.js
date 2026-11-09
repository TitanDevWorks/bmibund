/* Bundesstil: gemeinsame Zierde für Dienstportal, BfV-Seite und BMI-Seite.
   Quelle: verfassungsschutz_private/dienst/bundesstil.js. Gleiche Datei liegt als Kopie in
   verfassungsschutz/assets/ und bmibund/assets/ (nach Änderung dorthin kopieren, ?v= anheben).
   Baut ohne Inline-Styles (CSP style-src 'self'): Flaggenbalken oben, wehendes Fahnenband,
   Berliner Silhouette (Brandenburger Tor, Fernsehturm, Reichstag) und den Wahlspruch im Fuß.
   Kein Bundesadler, kein Hoheitszeichen. Bewegung nur per CSS, aus bei prefers-reduced-motion. */
(() => {
  'use strict';
  if (window.Bundesstil) return;
  let nr = 0;

  // ---- Fahnenband: drei Streifen, Welle läuft über zwei Perioden und wird um eine verschoben (nahtlos)
  const P = 1200, H = 150, STREIFEN = 30;
  const welle = (x, k) => {
    const v = x - k * 34; // jede Kante hängt ein wenig nach: wirkt wie Stoff
    return 15 * Math.sin((2 * Math.PI * v) / P) + 5 * Math.sin((4 * Math.PI * v) / P + 1.1);
  };
  const kante = (k) => {
    const y0 = (H - 3 * STREIFEN) / 2 + k * STREIFEN;
    const pkt = [];
    for (let x = 0; x <= 2 * P; x += 24) pkt.push([x, +(y0 + welle(x, k)).toFixed(1)]);
    return pkt;
  };
  const zug = pkt => pkt.map(p => p.join(' ')).join('L');
  const flaeche = (oben, unten) => 'M' + zug(oben) + 'L' + zug(unten.slice().reverse()) + 'Z';

  function fahnenband(klasse = '') {
    const id = 'bs' + (++nr);
    const k = [0, 1, 2, 3].map(kante);
    const div = document.createElement('div');
    div.className = ('bund-fahne ' + klasse).trim();
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `<svg viewBox="0 0 ${P} ${H}" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${P}" y2="0" spreadMethod="repeat">
          <stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".22" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".5" stop-color="#000" stop-opacity=".38"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#fff" stop-opacity=".16"/>
        </linearGradient>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84a"/><stop offset="1" stop-color="#e0a800"/></linearGradient>
        <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef2a2a"/><stop offset="1" stop-color="#b80d12"/></linearGradient>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3b40"/><stop offset="1" stop-color="#16171a"/></linearGradient>
      </defs>
      <g class="bf-lauf">
        <path fill="url(#${id}s)" d="${flaeche(k[0], k[1])}"/>
        <path fill="url(#${id}r)" d="${flaeche(k[1], k[2])}"/>
        <path fill="url(#${id}g)" d="${flaeche(k[2], k[3])}"/>
        <path fill="url(#${id}l)" d="${flaeche(k[0], k[3])}"/>
        <path class="bf-kante" fill="none" d="M${zug(k[0])}"/>
      </g>
    </svg>`;
    return div;
  }

  // ---- Berliner Silhouette als Linienzeichnung
  function silhouette(klasse = '') {
    const L = [];
    const r = (x, y, w, h) => L.push(`M${x} ${y}h${w}v${h}h${-w}Z`);
    const l = (x1, y1, x2, y2) => L.push(`M${x1} ${y1}L${x2} ${y2}`);
    const kreis = (x, y, rr) => L.push(`M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`);
    const B = 300; // Grundlinie

    // Brandenburger Tor
    r(70, 282, 360, 18); r(82, 272, 336, 10);
    for (const x of [96, 152, 208, 280, 336, 392]) { l(x, 272, x, 150); l(x + 12, 272, x + 12, 150); l(x - 3, 150, x + 15, 150); }
    r(80, 124, 340, 26); l(80, 137, 420, 137);
    for (let x = 92; x < 420; x += 22) l(x, 137, x, 150);
    r(150, 96, 200, 28); r(128, 110, 22, 14); r(350, 110, 22, 14);
    // Quadriga, stark vereinfacht: Sockel, Pferde als Bögen, Victoria mit Stab und Kranz
    r(212, 86, 76, 10);
    L.push('M216 86q6-20 18-16q5-9 13-3q7-8 14 0q7-5 11 4q6-2 8 15');
    l(250, 70, 250, 30); l(250, 30, 262, 22); kreis(262, 22, 6);

    // Fernsehturm
    l(556, B, 560, 120); l(574, B, 570, 120); r(548, 290, 34, 10);
    kreis(565, 116, 19); l(546, 116, 584, 116);
    r(561, 84, 8, 13); l(565, 84, 565, 22);

    // Reichstag
    const R0 = 660, R1 = 1150;
    r(R0, 160, R1 - R0, B - 160);
    for (const x of [R0 - 8, R1 - 64]) { r(x, 118, 72, B - 118); r(x - 4, 112, 80, 8); }
    for (let y = 196; y < 290; y += 34) for (const [a, b] of [[R0 + 82, 790], [972, R1 - 70]]) for (let x = a; x + 10 <= b; x += 22) r(x, y, 10, 20);
    // Portikus mit Giebel
    r(800, 176, 160, 12); L.push('M792 176L880 138L968 176Z');
    for (let i = 0; i < 6; i++) { const x = 812 + i * 26.4; l(x, 188, x, 286); l(x + 8, 188, x + 8, 286); }
    r(796, 286, 168, 14);
    // Kuppel
    L.push('M806 160Q806 70 880 66Q954 70 954 160');
    L.push('M842 160Q842 76 880 66Q918 76 918 160'); l(880, 66, 880, 138);
    L.push('M812 132Q880 122 948 132'); L.push('M809 104Q880 92 951 104');
    r(872, 54, 16, 12);
    // Fahnenmasten auf den vorderen Ecktürmen
    l(R0 + 28, 112, R0 + 28, 58); l(R1 - 28, 112, R1 - 28, 58);
    // Grundlinie
    l(0, B, 1220, B);

    const d = L.join('');
    const div = document.createElement('div');
    div.className = ('bund-silhouette ' + klasse).trim();
    div.setAttribute('aria-hidden', 'true');
    const mast = (x) => `<g class="bs-flagge" transform="translate(${x} 58)"><g class="bs-weh"><path class="bs-fs" d="M0 0h34v8H0z"/><path class="bs-fr" d="M0 8h34v8H0z"/><path class="bs-fg" d="M0 16h34v8H0z"/></g></g>`;
    const vb = 'viewBox="0 0 1220 304" preserveAspectRatio="xMidYMax meet" focusable="false"';
    // Ebene 1: feine Linien, Inschrift, Fahnen, Flugwarnlicht. Ebene 2: dieselben Linien in Gold, nur ein wandernder Lichtstreifen sichtbar.
    div.innerHTML = `<svg class="bs-basis" ${vb}>
      <path class="bs-linie" d="${d}"/>
      <text class="bs-inschrift" x="880" y="185" text-anchor="middle">DEM DEUTSCHEN VOLKE</text>
      ${mast(R0 + 28)}${mast(R1 - 28)}
      <circle class="bs-licht" cx="565" cy="22" r="3.2"/>
    </svg><svg class="bs-glanz" ${vb}><path class="bs-linie-gold" d="${d}"/></svg>`;
    return div;
  }

  // ---- Flaggenbalken oben auf jeder Seite
  function flagge() {
    if (document.querySelector('.bund-flagge')) return;
    const d = document.createElement('div');
    d.className = 'bund-flagge';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i></i><i></i><i></i>';
    document.body.prepend(d);
  }

  // ---- Wahlspruch im Fuß (wenn die Seite noch keinen hat)
  function wahlspruch(fuss) {
    if (fuss.querySelector('.motto, .bund-wahlspruch')) return;
    const ziel = fuss.querySelector('.container') || fuss;
    const d = document.createElement('div');
    d.className = 'bund-wahlspruch';
    d.innerHTML = '<span class="bw-zeichen" aria-hidden="true"><i></i><i></i><i></i></span><p>Einigkeit und Recht und Freiheit</p><small>Bundesrepublik Deutschland</small>';
    ziel.prepend(d);
  }

  // ---- Wo was hin soll (alle drei Frontends; was es auf einer Seite nicht gibt, wird übersprungen)
  const REGELN = [
    ['.hero, .poster, .anmeldung-bild, section.login', el => { el.classList.add('bund-buehne'); el.append(silhouette('bs-buehne'), fahnenband('bf-buehne')); }],
    ['.nav-fuss', el => { el.prepend(silhouette('bs-leiste')); }],
    ['footer.footer', el => {
      wahlspruch(el); el.classList.add('bund-fuss');
      const block = el.querySelector('.bund-wahlspruch'), motto = el.querySelector('.motto');
      if (block) block.append(silhouette('bs-fuss'));
      else if (motto) motto.after(silhouette('bs-fuss bs-mitte'));
    }],
  ];
  const fertig = new WeakSet();
  function schmuecken(wurzel) {
    for (const [sel, tun] of REGELN) {
      const treffer = wurzel.matches?.(sel) ? [wurzel] : [...(wurzel.querySelectorAll?.(sel) || [])];
      for (const el of treffer) { if (fertig.has(el)) continue; fertig.add(el); tun(el); }
    }
  }

  function los() {
    flagge();
    schmuecken(document.body);
    // Portal und Seiten bauen Teile per JS nach: neu eingehängte Bereiche ebenfalls schmücken
    new MutationObserver(liste => { for (const m of liste) for (const n of m.addedNodes) if (n.nodeType === 1) schmuecken(n); })
      .observe(document.body, { childList: true, subtree: true });
  }

  window.Bundesstil = { fahnenband, silhouette, schmuecken };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los, { once: true });
  else los();
})();
