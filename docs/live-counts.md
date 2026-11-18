# Live player counts and the visit counter

The home page shows **"N playing now · N visits"** in the footer and a green
**"N playing"** pill on each game's card while people are in it. The unlisted page
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

A page calls `record_visit` once per browser tab session (remembered in
`sessionStorage`), so refreshing doesn't inflate the count. The numbers are a simple
count, not proof against someone deliberately calling the function in a loop.

## Adding a game

**Plain HTML game:** add one tag. The game's Content-Security-Policy, if it has one,
must allow `https://abeqdmurddrkrqbnfylb.supabase.co` and
`wss://abeqdmurddrkrqbnfylb.supabase.co` in `connect-src`, and `https://michaelsturrup.com`
in `script-src`.

```html
<script src="https://michaelsturrup.com/live.js" data-game="my-new-game" defer></script>
```

**Game that already uses supabase-js** (Crokinole's `src/net/presence.ts` is the
example): join `site:presence` with a random presence key, `track({ g: slug, r: role })`
once subscribed, and call `rpc('record_visit', { p_page: slug })` once per session.

The slug must match the game's `slug` in `games.json`, or its card won't get a pill.
