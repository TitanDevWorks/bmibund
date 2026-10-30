// Gemeinsame Navigation und Footer für alle Seiten.
(() => {
  const PAGES = [
    ['index.html', 'Start'],
    ['massnahmen.html', 'Maßnahmen'],
    ['minister.html', 'Minister'],
    ['ministerium.html', 'Ministerium'],
    ['presse.html', 'Presse'],
    ['kontakt.html', 'Kontakt']
  ];
  const START = Date.UTC(2026, 9, 30); // Amtsantritt 30.10.2026
  const here = location.pathname.split('/').pop() || 'index.html';

  const day = Math.min(100, Math.max(1, Math.floor((Date.now() - START) / 86400000) + 1));
  window.BMIH_DAY = day;

  const links = PAGES.map(([href, label]) =>
    `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('');

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="read-progress" aria-hidden="true"></div>
    <div class="backdrop" aria-hidden="true"></div>
    <a class="sr-only" href="#main">Zum Inhalt springen</a>
    <header class="nav container">
      <div class="nav-inner">
        <a class="brand" href="index.html">
          <img src="assets/emblem.svg" alt="" width="30" height="36">
          <span><b>Bundesministerium</b><small>für Inneres und Heimat</small></span>
        </a>
        <nav class="nav-links" aria-label="Hauptnavigation">${links}</nav>
        <span class="day-chip" title="Amtstag seit Regierungsbildung"><i></i>TAG ${String(day).padStart(3, '0')}</span>
        <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Menü">
          <span></span><span></span>
        </button>
      </div>
      <nav id="mobile-menu" class="mobile-menu" aria-label="Mobile Navigation" hidden>${links}</nav>
    </header>`;
  document.body.prepend(...header.children);

  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('mobile-menu');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  });

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div class="stripe" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html">
            <img src="assets/emblem.svg" alt="" width="30" height="36">
            <span><b>Bundesministerium</b><small>für Inneres und Heimat</small></span>
          </a>
          <p class="muted" style="margin-top:16px;max-width:360px">Sicherheit, Ordnung und Zusammenhalt. Kabinett Gauland I, 3. Wahlperiode.</p>
        </div>
        <div>
          <h4>Themen</h4>
          <ul>
            <li><a href="massnahmen.html">Maßnahmenplan</a></li>
            <li><a href="ministerium.html#schwerpunkte">Schwerpunkte</a></li>
            <li><a href="ministerium.html#behoerden">Geschäftsbereich</a></li>
            <li><a href="presse.html">Pressemitteilungen</a></li>
          </ul>
        </div>
        <div>
          <h4>Service</h4>
          <ul>
            <li><a href="kontakt.html">Kontakt</a></li>
            <li><a href="presse.html#pressekontakt">Pressestelle</a></li>
            <li><a href="impressum.html">Impressum</a></li>
            <li><a href="datenschutz.html">Datenschutz</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-note">
        <span>© 2026 BMIH · Teil des Rollenspiels „Bundestag Fiktiv“ – <a href="impressum.html">fiktives Angebot</a></span>
        <span class="mono">Tag ${day} von 100</span>
      </div>
    </div>`;
  document.body.append(footer);
})();
