// Seite „Erlasse und Verfügungen“: veröffentlichte Dokumente live aus dem Dienstportal des BfV (über /api/erlasse,
// öffentliche Fassung ohne Bundesadler) und das feste Archiv aus data/erlasse.json (einfach erklärt, mit Volltext).
(() => {
  const { esc, fmtDate, reveal, P } = window.BMIH;
  const en = P.lang === 'en';
  const liste = document.getElementById('liste');

  const holen = (url) => fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const norm = (s) => String(s || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, '');

  function karte(d) {
    const punkte = (d.punkte || []).map((p) => `<li>${esc(p)}</li>`).join('');
    const volltext = (d.abschnitte || []).length
      ? `<details><summary>${en ? 'Read the full text' : 'Ganzen Text lesen'}</summary>${d.abschnitte.map((a) => `<h4>${esc(a.titel)}</h4>${a.absaetze.map((x) => `<p>${esc(x)}</p>`).join('')}`).join('')}${d.unterschrift ? `<p class="sig">${esc(d.unterschrift)}</p>` : ''}</details>`
      : '';
    const knoepfe = d.url ? `<div class="knoepfe"><a class="btn btn-sm" href="${esc(d.url)}" target="_blank" rel="noopener">${en ? 'Open document' : 'Dokument öffnen'} ↗</a></div>` : '';
    return `<article class="erlass reveal" id="${esc(d.id)}">
      <div class="erlass-kopf"><span class="dok-art">${esc(d.art)}</span><span class="az">${esc(d.nr)}</span>${d.datum ? `<time datetime="${esc(d.datum)}">${esc(fmtDate(d.datum))}</time>` : ''}</div>
      <h3>${esc(d.titel)}</h3>
      ${d.kurz ? `<p>${esc(d.kurz)}</p>` : ''}
      ${punkte ? `<ul class="erl-punkte">${punkte}</ul>` : ''}
      ${volltext}${knoepfe}
    </article>`;
  }

  reveal(document);
  (async () => {
    const [archiv, live] = await Promise.all([holen('data/erlasse.json'), holen('/api/erlasse')]);
    if (live) window.BMIH.beobachten?.('/api/erlasse', live); // automatisch aktualisieren (layout.js)
    const fest = (archiv && archiv.dokumente) || [];
    const neu = ((live && live.dokumente) || []).map((d) => ({ id: `dok-${d.id}`, art: d.typName, nr: d.nr, datum: d.datum, titel: d.titel,
      kurz: en ? 'Official version from the service portal (without national emblem).' : 'Amtliche Fassung aus dem Dienstportal (ohne Bundesadler).',
      url: `/api/erlasse/${encodeURIComponent(d.id)}` }));
    // Liegt ein Archiv-Eintrag auch live vor, bekommt er den Link auf die amtliche Fassung statt einer Doppelung
    for (const n of neu.slice()) {
      const f = fest.find((x) => norm(x.nr) === norm(n.nr));
      if (f) { f.url = n.url; neu.splice(neu.indexOf(n), 1); }
    }
    const alle = [...neu, ...fest].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    document.getElementById('live').hidden = !(live && live.verbunden);
    // Filter nach Dokumentart (Erlass, Verfügung, Antrag, Pressemitteilung …)
    const gruppe = (art) => { const x = String(art || '').toLowerCase(); return x.startsWith('verfügung') ? 'Verfügungen' : x.startsWith('erlass') ? 'Erlasse' : x.startsWith('antrag') ? 'Anträge' : x.startsWith('pressemitteilung') ? 'Pressemitteilungen' : 'Sonstiges'; };
    const EN = { Alle: 'All', Erlasse: 'Decrees', Verfügungen: 'Orders', Anträge: 'Motions', Pressemitteilungen: 'Press releases', Sonstiges: 'Other' };
    const zahl = {}; alle.forEach((d) => { const g = gruppe(d.art); zahl[g] = (zahl[g] || 0) + 1; });
    const arten = ['Erlasse', 'Verfügungen', 'Anträge', 'Pressemitteilungen', 'Sonstiges'].filter((g) => zahl[g]);
    const chips = document.getElementById('arten');
    let wahl = 'Alle';
    const zeigen = () => {
      const sicht = wahl === 'Alle' ? alle : alle.filter((d) => gruppe(d.art) === wahl);
      liste.innerHTML = sicht.length ? sicht.map(karte).join('') : `<p class="muted">${en ? 'Nothing published yet.' : 'Noch nichts veröffentlicht.'}</p>`;
      chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === wahl)));
      reveal(document);
    };
    chips.innerHTML = arten.length > 1 ? ['Alle', ...arten].map((g) => `<button type="button" data-g="${g}">${esc(en ? EN[g] : g)} <small>${g === 'Alle' ? alle.length : zahl[g]}</small></button>`).join('') : '';
    chips.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { wahl = b.dataset.g; zeigen(); } });
    zeigen();
    // Alter Link auf die frühere Sammelkarte führt zur ersten der drei Verfügungen
    const ziel = location.hash === '#z-006-008-2026' ? 'z-006-2026' : location.hash.slice(1);
    if (ziel) document.getElementById(ziel)?.scrollIntoView({ block: 'start' });
  })();
})();
