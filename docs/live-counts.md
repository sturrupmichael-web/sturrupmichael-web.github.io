# Live player counts and the visit counter

The home page shows **"N people playing now"** (all games together) under the header,
a **"N playing"** pill on every game's card (green when someone's in, grey at 0), and
**"N visits"** in the footer. The unlisted page
[/stats/](https://michaelsturrup.com/stats/) shows the details: players per game, live,
plus visits per page and per day for the last 30 days.

Everything runs on the same Supabase project as the games
(`https://abeqdmurddrkrqbnfylb.supabase.co`). No cookies, nothing personal is stored.

## Players: Realtime presence

Every game joins the Realtime presence channel **`site:presence`** and tracks:

```json
{ "g": "<the game's slug in games.json>", "r": "<role>" }
```

`live.js` listens on that channel and counts one person per entry, per game. An entry
disappears by itself when the tab closes. Role `"host"` is a shared TV screen (party
games), so it isn't counted; any other role is.

## Visits: one small table

`public.site_visits (page, day, visits)` holds one row per page per UTC day. Row level
security is on with no policies, so nobody can read or change the table directly. Pages
use three functions instead:

| Function | Who | What |
| --- | --- | --- |
| `record_visit(p_page)` | anyone | +1 for today. `p_page` must be lowercase letters, digits and dashes |
| `visit_totals()` | anyone | `page, total, today` |
| `visit_daily(p_days)` | anyone | `day, page, visits` for the last `p_days` days (max 366) |
| `site_stats()` | anyone | Totals only, for the stats page: per game runs, distinct players, wins, best score and last played (from `scores`, `scores_3d`, `ln_scores`, `nn_scores`), plus signed-in account count and open bug reports. No names, emails or ids |

A page calls `record_visit` once per browser tab session (remembered in
`sessionStorage`), so refreshing doesn't inflate the count. The numbers are a simple
count, not proof against someone deliberately calling the function in a loop.

**Don't count me:** the stats page has a switch that sets `localStorage`
`michaelsturrup.nocount = "1"` in that browser. `live.js` and Crokinole then skip
`record_visit`. It's per browser and per origin, and the games with a copied
`site-live.js` don't check it yet.

## Adding a game

**Plain HTML game:** add one tag. The game's Content-Security-Policy, if it has one,
must allow `https://abeqdmurddrkrqbnfylb.supabase.co` and
`wss://abeqdmurddrkrqbnfylb.supabase.co` in `connect-src`, and `https://michaelsturrup.com`
in `script-src`.

```html
<script src="https://michaelsturrup.com/live.js" data-game="my-new-game" defer></script>
```

**Game with a build step and a strict CSP** (Plague IT, Mini Network, Access Denied,
Helpdesk Survivors, Helpdesk Survivors 3D, League Night): copy `src/site-live.js` (or
League Night's `src/net/siteLive.ts`) and call `joinSiteLive('<slug>')` from the entry
point. It only runs on `michaelsturrup.com` hosts, so local dev and test suites stay
offline. Add `https://abeqdmurddrkrqbnfylb.supabase.co wss://abeqdmurddrkrqbnfylb.supabase.co`
to the page's `connect-src`.

**Game that already uses supabase-js** (Crokinole's `src/net/presence.ts` is the
example): join `site:presence` with a random presence key, `track({ g: slug, r: role })`
once subscribed, and call `rpc('record_visit', { p_page: slug })` once per session.

The slug must match the game's `slug` in `games.json`, or its card won't get a pill.
