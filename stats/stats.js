// The unlisted stats page: live players per game, visits (totals, trends, per day) and
// leaderboard numbers per game. Data comes from live.js (SiteLive) and the site_stats RPC.
// See docs/live-counts.md.

(() => {
  const num = new Intl.NumberFormat('en-US');
  const $ = (id) => document.getElementById(id);
  const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const when = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const NOCOUNT = 'michaelsturrup.nocount';
  const FETCH_DAYS = 90;

  function el(tag, attrs = {}, text) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  }

  let titles = { home: 'Home page' };
  let slugs = ['home']; // every page we expect, so pages with 0 visits still show
  const nameOf = (slug) => titles[slug] || slug;

  /** UTC day strings, oldest first, ending today. */
  function lastDays(n) {
    const out = [];
    const t = new Date();
    for (let i = n - 1; i >= 0; i--) {
      out.push(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - i)).toISOString().slice(0, 10));
    }
    return out;
  }

  /** "+40%", "−20%", "new" or "" for a this-vs-previous comparison. */
  function change(now, before) {
    if (!now && !before) return { text: '', cls: '' };
    if (!before) return { text: 'new', cls: 'up' };
    const pct = Math.round(((now - before) / before) * 100);
    if (pct === 0) return { text: '0%', cls: '' };
    return { text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, cls: pct > 0 ? 'up' : 'down' };
  }

  // ---- Playing now -------------------------------------------------------------

  function players() {
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
  }

  // ---- Visits ------------------------------------------------------------------

  // daily.get(page).get(day) = visits
  const daily = new Map();
  const visitsOn = (page, day) => {
    if (page) return daily.get(page)?.get(day) || 0;
    let s = 0;
    for (const m of daily.values()) s += m.get(day) || 0;
    return s;
  };
  const sumDays = (page, days) => days.reduce((s, d) => s + visitsOn(page, d), 0);

  let range = 30;
  let filter = '';

  function drawChart() {
    const days = lastDays(range);
    const values = days.map((d) => visitsOn(filter, d));
    const max = Math.max(1, ...values);
    $('v-max').textContent = num.format(max);
    $('v-days').classList.toggle('dense', range > 30);
    $('v-days').replaceChildren(
      ...days.map((d, i) => {
        const n = values[i];
        const label = `${short.format(new Date(`${d}T00:00:00Z`))}: ${num.format(n)} ${n === 1 ? 'visit' : 'visits'}`;
        const li = el('li', { title: label, 'aria-label': label });
        li.style.setProperty('--h', `${(n / max) * 100}%`);
        const bar = el('span');
        if (!n) bar.classList.add('zero');
        li.append(bar);
        if (range <= 7 && n) li.append(el('em', {}, num.format(n)));
        return li;
      }),
    );
    const fmt = (d) => short.format(new Date(`${d}T00:00:00Z`));
    $('v-axis').replaceChildren(
      el('span', {}, fmt(days[0])),
      el('span', {}, fmt(days[Math.floor(days.length / 2)])),
      el('span', {}, 'Today'),
    );
    const total = values.reduce((a, b) => a + b, 0);
    $('v-range-sum').textContent = `${num.format(total)} ${total === 1 ? 'visit' : 'visits'} to ${
      filter ? nameOf(filter) : 'all pages'
    } in the last ${range} days.`;
  }

  async function visits() {
    let totals = [];
    try {
      totals = (await window.SiteLive.totals()) || [];
      const rows = (await window.SiteLive.daily(FETCH_DAYS)) || [];
      for (const r of rows) {
        if (!daily.has(r.page)) daily.set(r.page, new Map());
        daily.get(r.page).set(r.day, Number(r.visits) || 0);
      }
    } catch {
      $('v-total').textContent = 'Couldn’t load';
      return;
    }

    const allTime = new Map(totals.map((r) => [r.page, Number(r.total) || 0]));
    const pages = [...new Set([...slugs, ...allTime.keys()])];
    const days14 = lastDays(14);
    const week = days14.slice(7);
    const prev = days14.slice(0, 7);
    const today = week[6];
    const yesterday = week[5];

    $('v-today').textContent = num.format(visitsOn('', today));
    $('v-yesterday').textContent = num.format(visitsOn('', yesterday));
    const w = sumDays('', week);
    $('v-week').textContent = num.format(w);
    const t = change(w, sumDays('', prev));
    $('v-trend').textContent = t.text && `(${t.text})`;
    $('v-trend').className = `trend ${t.cls}`;
    $('v-total').textContent = num.format([...allTime.values()].reduce((a, b) => a + b, 0));

    const rows = pages
      .map((p) => ({ p, today: visitsOn(p, today), week: sumDays(p, week), prev: sumDays(p, prev), all: allTime.get(p) || 0 }))
      .sort((a, b) => b.week - a.week || b.all - a.all || nameOf(a.p).localeCompare(nameOf(b.p)));
    $('v-pages').tBodies[0].replaceChildren(
      ...rows.map((r) => {
        const tr = el('tr', r.all ? {} : { class: 'idle' });
        const c = change(r.week, r.prev);
        tr.append(
          el('th', { scope: 'row' }, nameOf(r.p)),
          el('td', {}, num.format(r.today)),
          el('td', {}, num.format(r.week)),
          el('td', { class: `trend ${c.cls}` }, c.text || '–'),
          el('td', {}, num.format(r.all)),
        );
        return tr;
      }),
    );

    const sel = $('v-filter');
    for (const r of [...rows].sort((a, b) => nameOf(a.p).localeCompare(nameOf(b.p)))) sel.append(el('option', { value: r.p }, nameOf(r.p)));
    sel.addEventListener('change', () => {
      filter = sel.value;
      drawChart();
    });
    for (const b of document.querySelectorAll('.seg button')) {
      b.addEventListener('click', () => {
        range = Number(b.dataset.days);
        for (const o of document.querySelectorAll('.seg button')) o.setAttribute('aria-pressed', String(o === b));
        drawChart();
      });
    }
    drawChart();
  }

  // ---- Games (leaderboards, accounts, bug reports) ------------------------------

  async function games() {
    let s;
    try {
      s = await window.SiteLive.rpc('site_stats');
    } catch {
      $('g-accounts').textContent = 'Couldn’t load';
      return;
    }
    if (!s) return;
    $('g-accounts').textContent = num.format(s.accounts);
    $('g-accounts-7d').textContent = s.accounts_7d ? `(${num.format(s.accounts_7d)} new this week)` : '';
    $('g-bugs').textContent = num.format(s.bugs_open);
    const best = (g) => {
      if (g.best == null) return '–';
      if (g.best_kind === 'to_par') return g.best === 0 ? 'Even' : g.best > 0 ? `+${g.best}` : `−${Math.abs(g.best)}`;
      return num.format(g.best);
    };
    $('g-table').tBodies[0].replaceChildren(
      ...[...s.games]
        .sort((a, b) => b.runs - a.runs)
        .map((g) => {
          const tr = el('tr');
          tr.append(
            el('th', { scope: 'row' }, nameOf(g.game)),
            el('td', {}, num.format(g.runs)),
            el('td', {}, num.format(g.players)),
            el('td', {}, g.wins == null ? '–' : num.format(g.wins)),
            el('td', {}, best(g)),
            el('td', {}, g.last ? when.format(new Date(g.last)) : '–'),
          );
          return tr;
        }),
    );
  }

  // ---- Don't count me ----------------------------------------------------------

  function nocount() {
    const box = $('nocount');
    try {
      box.checked = localStorage.getItem(NOCOUNT) === '1';
    } catch {
      box.disabled = true;
    }
    box.addEventListener('change', () => {
      try {
        if (box.checked) localStorage.setItem(NOCOUNT, '1');
        else localStorage.removeItem(NOCOUNT);
      } catch {
        /* storage blocked */
      }
    });
  }

  async function main() {
    nocount();
    try {
      const list = await (await fetch('/games.json')).json();
      for (const g of list) {
        titles[g.slug] = g.title;
        slugs.push(g.slug);
      }
    } catch {
      /* slugs will do */
    }
    players();
    visits();
    games();
  }

  main();
})();
