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
    const fest = (archiv && archiv.dokumente) || [];
    const neu = ((live && live.dokumente) || []).map((d) => ({ id: `dok-${d.id}`, art: d.typName, nr: d.nr, datum: d.datum, titel: d.titel,
      kurz: en ? 'Official version from the service portal (fictional, without national emblem).' : 'Amtliche Fassung aus dem Dienstportal (fiktiv, ohne Bundesadler).',
      url: `/api/erlasse/${encodeURIComponent(d.id)}` }));
    // Liegt ein Archiv-Eintrag auch live vor, bekommt er den Link auf die amtliche Fassung statt einer Doppelung
    for (const n of neu.slice()) {
      const f = fest.find((x) => norm(x.nr) === norm(n.nr));
      if (f) { f.url = n.url; neu.splice(neu.indexOf(n), 1); }
    }
    const alle = [...neu, ...fest].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    document.getElementById('live').hidden = !(live && live.verbunden);
    liste.innerHTML = alle.length ? alle.map(karte).join('') : `<p class="muted">${en ? 'Nothing published yet.' : 'Noch nichts veröffentlicht.'}</p>`;
    reveal(document);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  })();
})();
