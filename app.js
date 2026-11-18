// Builds the game cards from games.json. Each entry:
//   title, slug, description, url, thumbnail (path under images/), thumbnailAlt,
//   tags (optional list), status (optional: "coming soon"),
//   updated (optional, "YYYY-MM-DD"): shown as "Updated Nov 15, 2026" on the card,
//   source (optional, { repo, branch, path }): where the game's code lives on GitHub. When
//     given, the page asks GitHub for the date of the newest commit there and shows that
//     instead if it is later than `updated`, so the date keeps itself current.
// A "coming soon" game shows its card without a working Play button.

const STATUS_LABELS = { 'coming soon': 'Coming soon' };
const OWNER = 'sturrupmichael-web';
const CACHE_KEY = 'card-dates-v1';
const CACHE_MS = 60 * 60 * 1000; // ask GitHub at most once an hour per visitor

// "2026-11-15" is a calendar day: format it as that day everywhere (no time-zone shift).
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const toDay = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const label = (day) => `Updated ${dayFormat.format(new Date(`${day}T00:00:00Z`))}`;

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function card(game) {
  const status = (game.status || '').toLowerCase();
  const playable = status !== 'coming soon' && game.url;
  const li = el('li', { class: 'card', id: game.slug });

  const img = el('img', {
    src: game.thumbnail,
    alt: game.thumbnailAlt || `Screenshot of ${game.title}`,
    width: '800',
    height: '420',
    loading: 'lazy',
    decoding: 'async',
  });
  // The thumbnail links to the game too, but is skipped by keyboard and screen readers:
  // the Play button is the one link they need.
  const thumb = playable ? el('a', { class: 'thumb', href: game.url, tabindex: '-1', 'aria-hidden': 'true' }) : el('div', { class: 'thumb' });
  if (playable) img.alt = '';
  thumb.append(img);

  const body = el('div', { class: 'body' });
  body.append(el('h3', {}, game.title));

  const tags = [...(STATUS_LABELS[status] ? [[STATUS_LABELS[status], 'tag status']] : []), ...(game.tags || []).map((t) => [t, 'tag'])];
  const ul = el('ul', { class: 'tags', 'aria-label': 'Tags' });
  if (game.updated && !STATUS_LABELS[status]) {
    const li = el('li', { class: 'tag status' });
    li.append(el('time', { datetime: game.updated }, label(game.updated)));
    ul.append(li);
  }
  for (const [t, cls] of tags) ul.append(el('li', { class: cls }, t));
  if (ul.children.length) body.append(ul);

  body.append(el('p', {}, game.description));

  if (playable) {
    const play = el('a', { class: 'play', href: game.url }, 'Play');
    play.append(el('span', { class: 'visually-hidden' }, ` ${game.title}`));
    body.append(play);
  } else {
    body.append(el('span', { class: 'play', 'aria-disabled': 'true' }, 'Coming soon'));
  }

  li.append(thumb, body);
  return li;
}

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && Date.now() - c.at < CACHE_MS) return c.days;
  } catch {
    /* no cache */
  }
  return null;
}

function writeCache(days) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), days }));
  } catch {
    /* private mode: just ask again next time */
  }
}

// The day of the newest commit on a game's branch (and folder), or null if GitHub doesn't answer.
async function lastCommitDay({ repo, branch, path }) {
  const q = new URLSearchParams({ per_page: '1' });
  if (branch) q.set('sha', branch);
  if (path) q.set('path', path);
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${encodeURIComponent(repo)}/commits?${q}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const [c] = await res.json();
  return c ? toDay(c.commit.committer.date) : null;
}

// Swap in newer dates from GitHub. Best effort: the dates from games.json stay if it fails.
async function refreshDates(games) {
  let days = readCache();
  if (!days) {
    const found = await Promise.all(games.map((g) => (g.source?.repo ? lastCommitDay(g.source).catch(() => null) : null)));
    days = Object.fromEntries(games.map((g, i) => [g.slug, found[i]]).filter(([, d]) => d));
    if (Object.keys(days).length) writeCache(days);
  }
  for (const g of games) {
    const day = days[g.slug];
    const time = document.querySelector(`#${CSS.escape(g.slug)} time`);
    if (!day || !time || (g.updated && day <= g.updated)) continue;
    time.dateTime = day;
    time.textContent = label(day);
  }
}

// Live counts from live.js: "N playing now" under the header (all games together), a
// "N playing" pill on every game's card (0 too, greyed), and "N visits" in the footer.
// Best effort: nothing shows if Supabase can't be reached.
const num = new Intl.NumberFormat('en-US');

function showLive() {
  const live = window.SiteLive;
  if (!live) return;
  const total = document.getElementById('live-total');
  const visits = document.getElementById('live-visits');

  live.onPlayers((counts, _state, connected) => {
    let all = 0;
    for (const n of Object.values(counts)) all += n;
    if (total) {
      total.hidden = !connected;
      total.classList.toggle('idle', all === 0);
      total.lastChild.textContent = `${num.format(all)} ${all === 1 ? 'person' : 'people'} playing now`;
    }
    for (const cardEl of document.querySelectorAll('.games .card[id]')) {
      let pill = cardEl.querySelector('.tag.live');
      if (!connected) {
        pill?.remove();
        continue;
      }
      const n = counts[cardEl.id] || 0;
      if (!pill) {
        let tags = cardEl.querySelector('.tags');
        if (!tags) {
          tags = el('ul', { class: 'tags', 'aria-label': 'Tags' });
          cardEl.querySelector('h3').after(tags);
        }
        pill = el('li', { class: 'tag live' });
        tags.prepend(pill);
      }
      pill.classList.toggle('idle', n === 0);
      pill.textContent = `${num.format(n)} playing`;
    }
  });

  if (!visits) return;
  live
    .totals()
    .then((rows) => {
      const sum = (rows || []).reduce((s, r) => s + Number(r.total || 0), 0);
      if (!sum) return;
      visits.textContent = `${num.format(sum)} ${sum === 1 ? 'visit' : 'visits'}`;
      visits.hidden = false;
    })
    .catch(() => {});
}

async function main() {
  document.getElementById('year').textContent = new Date().getFullYear();
  const list = document.getElementById('games');
  try {
    const res = await fetch('/games.json');
    if (!res.ok) throw new Error(res.status);
    const games = await res.json();
    list.replaceChildren(...games.map(card));
    refreshDates(games);
    showLive();
  } catch {
    list.replaceChildren(el('li', { class: 'message' }, 'The game list didn’t load. Try refreshing the page.'));
  }
}

main();
