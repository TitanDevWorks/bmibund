// Gemeinsamer Kopf (Servicezeile, Wortbildmarke, Hauptnavigation), Eilmeldung, Brotkrumen und Fuß.
(() => {
  const { esc, load, DAY } = window.BMIH;
  const PAGES = [
    ['index.html', 'Startseite'],
    ['massnahmen.html', 'Maßnahmenplan'],
    ['minister.html', 'Minister'],
    ['ministerium.html', 'Ministerium'],
    ['presse.html', 'Presse'],
    ['termine.html', 'Termine'],
    ['kontakt.html', 'Kontakt']
  ];
  const EXTRA = { 'impressum.html': 'Impressum', 'datenschutz.html': 'Datenschutz' };
  const here = location.pathname.split('/').pop() || 'index.html';
  const logo = `
    <span class="flag" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="words"><span>Bundesministerium</span><span>für Inneres</span><span>und Heimat</span></span>`;

  const links = PAGES.map(([href, label]) =>
    `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('');

  const head = document.createElement('div');
  head.innerHTML = `
    <a class="sr-only" href="#main">Zum Inhalt springen</a>
    <div class="servicebar">
      <div class="container">
        <span class="day">Amtstag <b>${DAY}</b> von 100 · Kabinett Gauland I</span>
        <nav aria-label="Service">
          <a href="presse.html#pressekontakt">Pressestelle</a>
          <a href="termine.html">Termine</a>
          <a href="kontakt.html">Kontakt</a>
        </nav>
      </div>
    </div>
    <header class="site-header">
      <div class="container head-row">
        <a class="logo" href="index.html" aria-label="Bundesministerium für Inneres und Heimat, zur Startseite">${logo}</a>
        <div class="head-tools">
          <a class="btn" href="massnahmen.html">100-Tage-Plan</a>
          <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mainnav">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>Menü
          </button>
        </div>
      </div>
      <nav class="mainnav" id="mainnav" aria-label="Hauptnavigation"><div class="container">${links}</div></nav>
    </header>
    <div class="eil" id="eil" role="alert" hidden><div class="container"><b>Eilmeldung</b><span></span></div></div>`;

  const label = (PAGES.find(([h]) => h === here) || [])[1] || EXTRA[here];
  if (label && here !== 'index.html') {
    const crumbs = document.createElement('nav');
    crumbs.className = 'crumbs container';
    crumbs.setAttribute('aria-label', 'Sie sind hier');
    crumbs.innerHTML = `<ol><li><a href="index.html">Startseite</a></li><li aria-current="page">${esc(label)}</li></ol>`;
    head.append(crumbs);
  }
  document.body.prepend(...head.children);

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
      <div class="footer-grid">
        <div>
          <a class="logo" href="index.html">${logo}</a>
          <p class="about">Sicherheit, Ordnung und Zusammenhalt. Kabinett Gauland I, 3. Wahlperiode.</p>
        </div>
        <div>
          <h4>Themen</h4>
          <ul>
            <li><a href="massnahmen.html">Maßnahmenplan</a></li>
            <li><a href="ministerium.html#schwerpunkte">Schwerpunkte</a></li>
            <li><a href="ministerium.html#behoerden">Geschäftsbereich</a></li>
          </ul>
        </div>
        <div>
          <h4>Presse</h4>
          <ul>
            <li><a href="presse.html">Pressemitteilungen</a></li>
            <li><a href="termine.html">Termine</a></li>
            <li><a href="presse.html#pressekontakt">Pressestelle</a></li>
          </ul>
        </div>
        <div>
          <h4>Service</h4>
          <ul>
            <li><a href="kontakt.html">Kontakt</a></li>
            <li><a href="impressum.html">Impressum</a></li>
            <li><a href="datenschutz.html">Datenschutz</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Bundesministerium für Inneres und Heimat</span>
        <span>Teil des Rollenspiels „Bundestag Fiktiv“, <a href="impressum.html">fiktives Angebot</a></span>
      </div>
    </div>`;
  document.body.append(footer);

  const top = document.createElement('button');
  top.className = 'to-top';
  top.type = 'button';
  top.setAttribute('aria-label', 'Nach oben');
  top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
  top.addEventListener('click', () => scrollTo({ top: 0 }));
  document.body.append(top);

  const onScroll = () => {
    header.classList.toggle('scrolled', scrollY > 40);
    top.classList.toggle('show', scrollY > 600);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  load('settings').then((s) => {
    if (s && s.eilmeldungAktiv && s.eilmeldung) {
      const eil = document.getElementById('eil');
      eil.querySelector('span').textContent = s.eilmeldung;
      eil.hidden = false;
    }
  }).catch(() => {});
})();
