// Sprache und Farbschema aus Cookies, früh im <head> geladen, damit nichts flackert.
(() => {
  const read = (name) => (document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)) || [])[1] || '';
  const lang = read('bmih_lang') === 'en' ? 'en' : 'de';
  const theme = read('bmih_theme') === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.lang = lang;
  root.dataset.lang = lang;
  root.dataset.theme = theme;

  function set(name, value) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `bmih_${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  // Übersetzungen für Texte, die per JavaScript entstehen. Schlüssel ist der deutsche Text.
  const EN = {
    'Startseite': 'Home', 'Maßnahmenplan': 'Action plan', 'Gesetze': 'Legislation', 'Minister': 'Minister',
    'Ministerium': 'Ministry', 'Presse': 'Press', 'Termine': 'Schedule', 'Kontakt': 'Contact',
    'Impressum': 'Legal notice', 'Datenschutz': 'Privacy', 'Pressestelle': 'Press office',
    'Amtstag': 'Day', 'von 100': 'of 100', 'Menü': 'Menu', 'Sie sind hier': 'You are here',
    '100-Tage-Plan': '100-day plan', 'Eilmeldung': 'Breaking', 'Nach oben': 'Back to top',
    'Zum Inhalt springen': 'Skip to content', 'Hell': 'Light', 'Dunkel': 'Dark',
    'Themen': 'Topics', 'Service': 'Service', 'Schwerpunkte': 'Priorities',
    'Geschäftsbereich': 'Agencies', 'Pressemitteilungen': 'Press releases', 'Gesetzesvorhaben': 'Bills',
    'Offen': 'Open', 'In Arbeit': 'In progress', 'Im Kabinett': 'In cabinet', 'Abgeschlossen': 'Completed',
    'Fortschritt': 'Progress', 'Phase': 'Phase', 'Bereich': 'Area', 'Zuständig': 'Responsible',
    'Frist': 'Deadline', 'Grundlage': 'Basis', 'Keine weitere Beschreibung.': 'No further description.',
    'Maßnahme': 'measure', 'Maßnahmen': 'measures', 'von': 'of', 'im Plan': 'in the plan',
    'Keine Einträge': 'No entries', 'Keine Maßnahmen für diese Auswahl.': 'No measures match this selection.',
    'Noch keine Meldungen.': 'No press releases yet.', 'Keine Meldungen gefunden.': 'No press releases found.',
    'Keine anstehenden Termine.': 'No upcoming appointments.', 'Noch keine vergangenen Termine.': 'No past appointments yet.',
    'Aktuell ist keine Maßnahme in Bearbeitung.': 'No measure is currently in progress.',
    'Daten konnten nicht geladen werden.': 'Data could not be loaded.',
    'anstehender Termin': 'upcoming appointment', 'anstehende Termine': 'upcoming appointments',
    'Stand': 'As of', 'Wird gesendet …': 'Sending …',
    'Vielen Dank. Ihre Nachricht ist eingegangen.': 'Thank you. Your message has been received.',
    'Server nicht erreichbar. Bitte später erneut versuchen.': 'Server unreachable. Please try again later.',
    'Senden fehlgeschlagen.': 'Sending failed.',
    'Pressemitteilung': 'Press release', 'Rede': 'Speech', 'Interview': 'Interview', 'Statement': 'Statement',
    'Termin': 'Appointment', 'Pressekonferenz': 'Press conference', 'Kabinett': 'Cabinet', 'Bundestag': 'Bundestag',
    'Reise': 'Trip', 'Bundesrat': 'Bundesrat', 'Verkündet': 'Enacted', 'Gestoppt': 'Stopped',
    'In Vorbereitung': 'In preparation', 'Referentenentwurf': 'Draft bill',
    'Zieltag': 'Target day', 'Nächster Schritt': 'Next step', 'Kernpunkte': 'Key points',
    'Noch keine Gesetzesvorhaben.': 'No bills yet.',
    'Tag': 'Day', 'heute': 'today', 'überfällig': 'overdue', 'noch': 'in', 'Tage': 'days', 'Tagen': 'days',
    'läuft gerade': 'happening now', 'Std.': 'h', 'Min.': 'min',
    'Inhalte aus der Datenbank sind nur auf Deutsch verfügbar.': 'Some content is only available in German.'
  };
  const t = (de) => (lang === 'en' && Object.hasOwn(EN, de) ? EN[de] : de);
  const tPhase = (p) => (lang === 'en' ? String(p || '').replace(/^Tag /, 'Day ') : p); // „Tag 1–10“ → „Day 1–10“

  // Statische Texte: Elemente mit data-en tauschen Text, Platzhalter und Beschriftung aus.
  function translate(root = document) {
    if (lang !== 'en') return;
    root.querySelectorAll('[data-en]').forEach((el) => { el.textContent = el.dataset.en; });
    root.querySelectorAll('[data-en-placeholder]').forEach((el) => { el.placeholder = el.dataset.enPlaceholder; });
    root.querySelectorAll('[data-en-label]').forEach((el) => { el.setAttribute('aria-label', el.dataset.enLabel); });
    if (document.body?.dataset.titleEn) document.title = document.body.dataset.titleEn;
  }

  window.BMIH_PREFS = { lang, theme, set, t, tPhase, translate, locale: lang === 'en' ? 'en-GB' : 'de-DE' };
})();
