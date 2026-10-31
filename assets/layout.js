// Gemeinsamer Kopf (Flaggenleiste, Servicezeile, Wortbildmarke, Hauptnavigation), Eilmeldung, Brotkrumen und Fuß.
(() => {
  const { esc, load, DAY, t, P } = window.BMIH;
  const PAGES = [
    ['index.html', 'Startseite'],
    ['massnahmen.html', 'Maßnahmenplan'],
    ['gesetze.html', 'Gesetze'],
    ['minister.html', 'Minister'],
    ['ministerium.html', 'Ministerium'],
    ['presse.html', 'Presse'],
    ['termine.html', 'Termine'],
    ['kontakt.html', 'Kontakt']
  ];
  const EXTRA = { 'impressum.html': 'Impressum', 'datenschutz.html': 'Datenschutz' };
  const here = location.pathname.split('/').pop() || 'index.html';
  const en = P.lang === 'en';
  const logo = `<span class="flag" aria-hidden="true"><i></i><i></i><i></i></span>${en
    ? '<span class="words"><span>Federal Ministry</span><span>of the Interior</span><span>and Homeland</span></span>'
    : '<span class="words"><span>Bundesministerium</span><span>für Inneres</span><span>und Heimat</span></span>'}`;

  const links = PAGES.map(([href, label]) =>
    `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${esc(t(label))}</a>`).join('');

  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const dark = P.theme === 'dark';
  const themeLabel = dark ? (en ? 'Switch to light mode' : 'Hellen Modus einschalten') : (en ? 'Switch to dark mode' : 'Dunklen Modus einschalten');

  const head = document.createElement('div');
  head.innerHTML = `
    <a class="sr-only" href="#main">${esc(t('Zum Inhalt springen'))}</a>
    <div class="flagbar" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="servicebar">
      <div class="container">
        <span class="day">${esc(t('Amtstag'))} <b>${DAY}</b> ${esc(t('von 100'))} · ${en ? 'Gauland I cabinet' : 'Kabinett Gauland I'}</span>
        <div class="prefs">
          <nav aria-label="Service">
            <a href="presse.html#pressekontakt">${esc(t('Pressestelle'))}</a>
            <a href="termine.html">${esc(t('Termine'))}</a>
            <a href="kontakt.html">${esc(t('Kontakt'))}</a>
          </nav>
          <div class="switch" role="group" aria-label="${en ? 'Language' : 'Sprache'}">
            <button type="button" data-lang-set="de" aria-pressed="${!en}" lang="de" title="Deutsch">DE</button>
            <button type="button" data-lang-set="en" aria-pressed="${en}" lang="en" title="English">EN</button>
          </div>
          <button class="theme-btn" type="button" data-theme-toggle aria-label="${themeLabel}" title="${themeLabel}">${dark ? sun : moon}<span>${esc(t(dark ? 'Hell' : 'Dunkel'))}</span></button>
        </div>
      </div>
    </div>
    <header class="site-header">
      <div class="container head-row">
        <a class="logo" href="index.html" aria-label="${en ? 'Federal Ministry of the Interior and Homeland, home' : 'Bundesministerium für Inneres und Heimat, zur Startseite'}">${logo}</a>
        <div class="head-tools">
          <a class="btn" href="gesetze.html">${esc(t('Gesetzesvorhaben'))}</a>
          <a class="btn btn-primary" href="massnahmen.html">${esc(t('100-Tage-Plan'))}</a>
          <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mainnav">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>${esc(t('Menü'))}
          </button>
        </div>
      </div>
      <nav class="mainnav" id="mainnav" aria-label="${en ? 'Main navigation' : 'Hauptnavigation'}"><div class="container">${links}</div></nav>
    </header>
    <div class="eil" id="eil" role="alert" hidden><div class="container"><b>${esc(t('Eilmeldung'))}</b><span></span></div></div>`;

  const label = (PAGES.find(([h]) => h === here) || [])[1] || EXTRA[here];
  if (label && here !== 'index.html') {
    const crumbs = document.createElement('nav');
    crumbs.className = 'crumbs container';
    crumbs.setAttribute('aria-label', t('Sie sind hier'));
    crumbs.innerHTML = `<ol><li><a href="index.html">${esc(t('Startseite'))}</a></li><li aria-current="page">${esc(t(label))}</li></ol>`;
    head.append(crumbs);
  }
  document.body.prepend(...head.children);

  // Auswahl per Cookie merken und neu laden, damit alle Texte einheitlich sind.
  document.querySelectorAll('[data-lang-set]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.langSet === P.lang) return;
    P.set('lang', b.dataset.langSet);
    location.reload();
  }));
  document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
    const next = dark ? 'light' : 'dark';
    P.set('theme', next);
    document.documentElement.dataset.theme = next;
    location.reload();
  });

  const header = document.querySelector('.site-header');
  const btn = header.querySelector('.menu-btn');
  const nav = document.getElementById('mainnav');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="flagline" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="container">
      <p class="motto">Einigkeit und Recht und Freiheit</p>
      <div class="footer-grid">
        <div>
          <a class="logo" href="index.html">${logo}</a>
          <p class="about">${en ? 'Security, order and cohesion. Gauland I cabinet, 3rd legislative term.' : 'Sicherheit, Ordnung und Zusammenhalt. Kabinett Gauland I, 3. Wahlperiode.'}</p>
        </div>
        <div>
          <h4>${esc(t('Themen'))}</h4>
          <ul>
            <li><a href="massnahmen.html">${esc(t('Maßnahmenplan'))}</a></li>
            <li><a href="gesetze.html">${esc(t('Gesetzesvorhaben'))}</a></li>
            <li><a href="ministerium.html#schwerpunkte">${esc(t('Schwerpunkte'))}</a></li>
            <li><a href="ministerium.html#behoerden">${esc(t('Geschäftsbereich'))}</a></li>
          </ul>
        </div>
        <div>
          <h4>${esc(t('Presse'))}</h4>
          <ul>
            <li><a href="presse.html">${esc(t('Pressemitteilungen'))}</a></li>
            <li><a href="termine.html">${esc(t('Termine'))}</a></li>
            <li><a href="presse.html#pressekontakt">${esc(t('Pressestelle'))}</a></li>
          </ul>
        </div>
        <div>
          <h4>${esc(t('Service'))}</h4>
          <ul>
            <li><a href="kontakt.html">${esc(t('Kontakt'))}</a></li>
            <li><a href="impressum.html">${esc(t('Impressum'))}</a></li>
            <li><a href="datenschutz.html">${esc(t('Datenschutz'))}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 ${en ? 'Federal Ministry of the Interior and Homeland' : 'Bundesministerium für Inneres und Heimat'}</span>
        <span>${en ? 'Part of the role-play server' : 'Teil des Rollenspielservers'} <b>BDR: Bundesrepublik Deutschland RP</b> (Roblox), <a href="impressum.html">${en ? 'fictional site' : 'fiktives Angebot'}</a></span>
      </div>
      ${en ? `<p class="footer-note">${esc(t('Inhalte aus der Datenbank sind nur auf Deutsch verfügbar.'))}</p>` : ''}
    </div>`;
  document.body.append(footer);

  const top = document.createElement('button');
  top.className = 'to-top';
  top.type = 'button';
  top.setAttribute('aria-label', t('Nach oben'));
  top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
  top.addEventListener('click', () => scrollTo({ top: 0 }));
  document.body.append(top);

  const onScroll = () => {
    header.classList.toggle('scrolled', scrollY > 40);
    top.classList.toggle('show', scrollY > 600);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  P.translate();

  // Dev-Ansicht im Wartungsmodus: Hinweisleiste mit „Dev-Modus beenden“.
  fetch('/api/gate/status', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((g) => {
    if (!g || !g.aktiv || !g.frei) return;
    const bar = document.createElement('div');
    bar.className = 'devbar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span><b>${en ? 'Developer view' : 'Dev-Ansicht'}</b> ${en ? 'Maintenance mode is on. Visitors only see the waiting page.' : 'Wartungsmodus ist an. Besucher sehen nur die Warteseite.'}</span><button type="button">${en ? 'Exit developer mode' : 'Dev-Modus beenden'}</button>`;
    bar.querySelector('button').addEventListener('click', () => {
      fetch('/api/gate/lock', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .finally(() => location.replace(`/wartung.html?ziel=${encodeURIComponent(location.pathname)}`));
    });
    document.body.prepend(bar);
  }).catch(() => {});

  load('settings').then((s) => {
    if (s && s.eilmeldungAktiv && s.eilmeldung) {
      const eil = document.getElementById('eil');
      eil.querySelector('span').textContent = s.eilmeldung;
      eil.hidden = false;
    }
  }).catch(() => {});
})();
