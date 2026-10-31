// Warteseite im Wartungsmodus: Countdown und Freischaltung per Dev-Code.
// Die Prüfung des Codes passiert ausschließlich auf dem Server.
(() => {
  const P = window.BMIH_PREFS;
  const $ = (s) => document.querySelector(s);
  const en = P.lang === 'en';
  P.translate();

  // Nur Ziele auf derselben Seite zulassen.
  function target() {
    const raw = new URLSearchParams(location.search).get('ziel') || '/';
    // Nur einfache eigene Pfade wie /gesetze.html; nichts, was mit // oder \\ zu einer fremden Seite führen kann.
    if (!/^\/[A-Za-z0-9_\-]*(\/[A-Za-z0-9_\-]+)*(\.html)?\/?$/.test(raw) || raw === '/wartung.html') return '/';
    return raw;
  }

  // Datum und Uhrzeit sind deutsche Zeit (Europe/Berlin), unabhängig vom Gerät.
  function berlinTime(datum, zeit) {
    const [y, mo, d] = datum.split('-').map(Number);
    const [h, mi] = (zeit || '00:00').split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const berlin = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const utc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
    return guess - (berlin - utc);
  }

  let timer;
  function countdown(datum, zeit) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || '')) return;
    const goal = berlinTime(datum, zeit);
    const when = $('#wait-when');
    const fmt = new Intl.DateTimeFormat(P.locale, { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    when.textContent = en ? `${fmt.format(goal)} (German time)` : `${fmt.format(goal)} Uhr`;
    when.hidden = false;
    const clock = $('#wait-clock');
    clock.hidden = false;
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const left = Math.max(0, goal - Date.now());
      $('#cd-d').textContent = Math.floor(left / 86400000);
      $('#cd-h').textContent = pad(Math.floor(left / 3600000) % 24);
      $('#cd-m').textContent = pad(Math.floor(left / 60000) % 60);
      $('#cd-s').textContent = pad(Math.floor(left / 1000) % 60);
      if (left === 0) {
        clearInterval(timer);
        clock.classList.add('done');
        when.textContent = en ? 'The session has begun. The website will be unlocked shortly.' : 'Die Sitzung hat begonnen. Die Webseite wird in Kürze freigeschaltet.';
      }
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  async function status() {
    try {
      const res = await fetch('/api/gate/status', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const s = await res.json();
      if (!s.aktiv || s.frei) { location.replace(target()); return; }
      // Eigene Texte aus der Verwaltung nur auf Deutsch, Englisch bleibt beim Standardtext.
      if (!en) {
        if (s.titel) $('#wait-title').textContent = s.titel;
        if (s.text) $('#wait-text').textContent = s.text;
        document.title = `${s.titel || 'Warten auf die konstituierende Sitzung'} · Bundesministerium für Inneres und Heimat`;
      }
      countdown(s.datum, s.zeit);
    } catch (_) {
      countdown('2026-11-01', '20:00');
    }
  }

  $('#dev-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#dev-code');
    const msg = $('#dev-msg');
    const btn = e.currentTarget.querySelector('button');
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = en ? 'Checking …' : 'Wird geprüft …';
    try {
      const res = await fetch('/api/gate/unlock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input.value })
      });
      input.value = '';
      if (res.ok) { msg.textContent = en ? 'Unlocked.' : 'Freigeschaltet.'; location.replace(target()); return; }
      msg.className = 'msg err';
      if (res.status === 429) msg.textContent = en ? 'Too many attempts. Please try again in 15 minutes.' : 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.';
      else msg.textContent = en ? 'Invalid code.' : 'Code ungültig.';
    } catch (_) {
      msg.className = 'msg err';
      msg.textContent = en ? 'Server unreachable.' : 'Server nicht erreichbar.';
    } finally {
      btn.disabled = false;
    }
  });

  status();
})();
