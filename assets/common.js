// Gemeinsame Helfer: Daten laden, Escaping, Animationen.
window.BMIH = (() => {
  const PHASES = ['Tag 1–10', 'Tag 11–50', 'Tag 51–100'];
  const STATUSES = ['Offen', 'In Arbeit', 'Im Kabinett', 'Abgeschlossen'];
  const STATUS_KEY = { 'Offen': 'offen', 'In Arbeit': 'arbeit', 'Im Kabinett': 'kabinett', 'Abgeschlossen': 'fertig' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtDate = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? esc(iso) : dateFmt.format(d);
  };

  // Live aus dem Backend, sonst statische Kopie.
  async function load(name) {
    try {
      const res = await fetch(`/api/${name}`, { headers: { Accept: 'application/json' } });
      if (res.ok) return await res.json();
    } catch (_) { /* Fallback */ }
    const res = await fetch(`data/${name}.json`);
    return res.json();
  }

  const byDateDesc = (a, b) => String(b.datum).localeCompare(String(a.datum));

  function measureCard(m) {
    const key = STATUS_KEY[m.status] || 'offen';
    return `
      <article class="m-card" data-s="${key}">
        <div class="m-meta">
          <span class="chip status"><span class="dot ${key}"></span>${esc(m.status)}</span>
          <span class="chip">${esc(m.phase)}</span>
          ${m.bereich ? `<span class="chip">${esc(m.bereich)}</span>` : ''}
        </div>
        <h4>${esc(m.titel)}</h4>
        ${m.beschreibung ? `<p>${esc(m.beschreibung)}</p>` : ''}
        ${m.grundlage ? `<div class="m-foot">§ ${esc(m.grundlage)}</div>` : ''}
      </article>`;
  }

  // Maus-Spotlight auf Karten
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.m-card, .tile');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });

  // Einblenden beim Scrollen
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  function reveal(root = document) {
    root.querySelectorAll('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  }
  document.addEventListener('DOMContentLoaded', () => reveal());

  // Zahlen hochzählen
  function countUp(el, to) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !to) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(to * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function daysBar(el, day) {
    el.innerHTML = Array.from({ length: 100 }, (_, i) => {
      const n = i + 1;
      const cls = [n < day ? 'past' : '', n === day ? 'today' : '', n === 11 || n === 51 ? 'edge' : ''].join(' ').trim();
      return `<i style="--i:${i}" class="${cls}" title="Tag ${n}"></i>`;
    }).join('');
  }

  // Sanfter Wechsel, wo View Transitions unterstützt werden
  const transition = (fn) => (document.startViewTransition ? document.startViewTransition(fn) : fn());

  return { PHASES, STATUSES, STATUS_KEY, esc, fmtDate, load, byDateDesc, measureCard, reveal, countUp, daysBar, transition };
})();
