// The unlisted stats page: live players per game, visit totals and the last 30 days.
// Data comes from live.js (SiteLive). See docs/live-counts.md.

(() => {
  const num = new Intl.NumberFormat('en-US');
  const $ = (id) => document.getElementById(id);
  const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  function el(tag, attrs = {}, text) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  }

  let titles = { home: 'Home page' };
  const nameOf = (slug) => titles[slug] || slug;

  async function main() {
    try {
      const games = await (await fetch('/games.json')).json();
      for (const g of games) titles[g.slug] = g.title;
    } catch {
      /* slugs will do */
    }

    const conn = $('conn');
    window.SiteLive.onPlayers((counts) => {
      conn.classList.add('on');
      conn.title = 'Live';
      const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const total = rows.reduce((s, [, n]) => s + n, 0);
      $('now-total').textContent = `${num.format(total)} ${total === 1 ? 'person' : 'people'}`;
      $('now-games').replaceChildren(
        ...(rows.length
          ? rows.map(([slug, n]) => {
              const li = el('li');
              li.append(el('span', {}, nameOf(slug)), el('strong', {}, num.format(n)));
              return li;
            })
          : [el('li', { class: 'muted' }, 'Nobody is playing right now.')]),
      );
    });

    try {
      const rows = (await window.SiteLive.totals()) || [];
      const sum = (k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
      $('v-today').textContent = num.format(sum('today'));
      $('v-total').textContent = num.format(sum('total'));
      $('v-pages').tBodies[0].replaceChildren(
        ...rows.map((r) => {
          const tr = el('tr');
          tr.append(el('th', { scope: 'row' }, nameOf(r.page)), el('td', {}, num.format(r.today)), el('td', {}, num.format(r.total)));
          return tr;
        }),
      );
    } catch {
      $('v-total').textContent = 'Couldn’t load';
    }

    try {
      const rows = (await window.SiteLive.daily(30)) || [];
      const byDay = new Map();
      for (const r of rows) byDay.set(r.day, (byDay.get(r.day) || 0) + Number(r.visits));
      const days = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
        days.push(d.toISOString().slice(0, 10));
      }
      const max = Math.max(1, ...days.map((d) => byDay.get(d) || 0));
      $('v-days').replaceChildren(
        ...days.map((d) => {
          const n = byDay.get(d) || 0;
          const label = `${short.format(new Date(`${d}T00:00:00Z`))}: ${num.format(n)}`;
          const li = el('li', { title: label, 'aria-label': label });
          const bar = el('span');
          bar.style.setProperty('--h', `${(n / max) * 100}%`);
          li.append(bar);
          return li;
        }),
      );
    } catch {
      /* chart stays empty */
    }
  }

  main();
})();
