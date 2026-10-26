# michaelsturrup.com

The landing page for Michael Sturrup's games. It's plain HTML, CSS and a little
JavaScript: no framework, no build step, no tracking. GitHub Pages serves it at
<https://michaelsturrup.com>, and www.michaelsturrup.com redirects there.

| File | What it is |
| --- | --- |
| `index.html` | The page: header, card grid, link-preview tags |
| `games.json` | The list of games. The cards are built from this file |
| `app.js` | Reads `games.json` and draws the cards |
| `style.css` | All styling, light and dark mode included |
| `images/` | One thumbnail per game |
| `404.html` | Shown for any address that doesn't exist |
| `og-image.jpg` | The picture that shows when someone shares the link (1200×630) |
| `favicon.svg`, `apple-touch-icon.png` | Browser tab and home-screen icons |
| `CNAME` | Tells GitHub Pages the domain name. Don't delete it |
| `OathofStur/` | Oath of Stur play-test build. Unlisted: not in `games.json`, marked noindex, reachable only by its link |

## Add a new game

1. **Take a screenshot** of the game in a landscape window, cropped to roughly 40:21
   (for example 1200×630). Save it as `images/<slug>.webp` (or `.jpg` / `.png`) and
   keep it under about 150 KB. Use [squoosh.app](https://squoosh.app) to convert and
   shrink it.
2. **Add an entry to `games.json`.** Copy an existing one and change the values:

   ```json
   {
     "title": "My New Game",
     "slug": "my-new-game",
     "description": "One or two sentences about what you do in it.",
     "url": "https://michaelsturrup.com/my-new-game/",
     "thumbnail": "images/my-new-game.webp",
     "thumbnailAlt": "What the screenshot shows, for screen readers",
     "tags": ["Puzzle"],
     "status": "new"
   }
   ```

   - `status` is optional: `"new"` adds a badge, and `"coming soon"` shows the card
     with no Play button (`url` can then be empty). Leave it out for neither.
   - `tags` is optional. Games appear in the order they're listed, so put the newest
     first.
   - Mind the commas between entries. The page shows "The game list didn't load" if
     the JSON is broken. [jsonlint.com](https://jsonlint.com) finds the mistake.
3. **Commit and push to `main`.** The site updates within a minute or two.

### Where the game itself lives

The easiest way: put each game in its **own GitHub repository** and turn on GitHub
Pages for it (Settings > Pages) **without** a CNAME file or custom domain. Because
this repository is the account's user site (`sturrupmichael-web.github.io`) and uses
michaelsturrup.com, GitHub automatically serves the game at
`https://michaelsturrup.com/<repo-name>/`. No DNS changes are needed. Name the repo
the way you want the URL to read (for example `my-new-game`). Inside the game, use
relative paths (`img/x.png`, not `/img/x.png`), because the game runs under a
folder.

A game can also have its own subdomain, the way Helpdesk Survivors does: add a CNAME
file with `newgame.michaelsturrup.com` to the game's repo, then add a DNS record in
Squarespace: CNAME, host `newgame`, value `sturrupmichael-web.github.io`.

Small games with no build step can also go straight into this repo in a folder
(`my-new-game/index.html`). They are then served at `michaelsturrup.com/my-new-game/`.

## Unlisted play-tests

A game can live here without a card: put it in a folder and leave it out of
`games.json`. It's then reachable only by its direct link. Add
`<meta name="robots" content="noindex, nofollow">` to its page so search engines
skip it too.

`OathofStur/index.html` is the Oath of Stur play-test, served at
<https://michaelsturrup.com/OathofStur/>. It's a single self-contained file built in
the game's repository (sturrupmichael-web/OathofStur-RPG): run
`npm run build:single` in `client/`, then copy `client/dist/single.html` here as
`OathofStur/index.html`, keeping the robots line.

## Preview locally

The page loads `games.json` with `fetch`, so opening `index.html` straight from
disk won't show the cards. Serve the folder instead:

```sh
cd michaelsturrup.com     # this repository
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Edit, save, and refresh. To check dark mode, switch
your computer or phone to dark mode, or use your browser's developer tools
(Rendering > "prefers-color-scheme").

## How deployment works

- GitHub Pages publishes the `main` branch as-is ("Deploy from a branch", `main`,
  `/ (root)`). There's no build step. Every push to `main` goes live, usually within
  a minute. Watch progress under the repo's **Actions** tab ("pages build and
  deployment").
- **Settings > Pages** has the custom domain `michaelsturrup.com` with **Enforce
  HTTPS** ticked. GitHub renews the certificate on its own.
- DNS is at Squarespace (Domains > michaelsturrup.com > DNS):

  | Type | Host | Value |
  | --- | --- | --- |
  | A | @ | 185.199.108.153 |
  | A | @ | 185.199.109.153 |
  | A | @ | 185.199.110.153 |
  | A | @ | 185.199.111.153 |
  | AAAA | @ | 2606:50c0:8000::153 |
  | AAAA | @ | 2606:50c0:8001::153 |
  | AAAA | @ | 2606:50c0:8002::153 |
  | AAAA | @ | 2606:50c0:8003::153 |
  | CNAME | www | sturrupmichael-web.github.io |
  | CNAME | game | sturrupmichael-web.github.io |

  The `game` record serves Helpdesk Survivors from its own repository
  (sturrupmichael-web/helpdesksurvivor), which has its own CNAME file.
- To try a change without putting it live, push it to another branch and preview it
  locally (see above), or open a pull request and look at the files before merging.
