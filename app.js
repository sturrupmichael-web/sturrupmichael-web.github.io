// Builds the game cards from games.json. Each entry:
//   title, slug, description, url, thumbnail (path under images/), thumbnailAlt,
//   tags (optional list), status (optional: "new" or "coming soon").
// A "coming soon" game shows its card without a working Play button.

const STATUS_LABELS = { new: 'New', 'coming soon': 'Coming soon' };

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
  if (tags.length) {
    const ul = el('ul', { class: 'tags', 'aria-label': 'Tags' });
    for (const [t, cls] of tags) ul.append(el('li', { class: cls }, t));
    body.append(ul);
  }

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

async function main() {
  document.getElementById('year').textContent = new Date().getFullYear();
  const list = document.getElementById('games');
  try {
    const res = await fetch('/games.json');
    if (!res.ok) throw new Error(res.status);
    const games = await res.json();
    list.replaceChildren(...games.map(card));
  } catch {
    list.replaceChildren(el('li', { class: 'message' }, 'The game list didn’t load. Try refreshing the page.'));
  }
}

main();
