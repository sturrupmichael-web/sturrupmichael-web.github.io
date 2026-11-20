// Live player counts and the site visit counter. No library, no cookies.
//
// Players: every game joins the Supabase Realtime presence channel "site:presence" and
// says { g: <slug from games.json>, r: <role> }. This file listens on that channel (it
// never tracks itself unless the page asks to, see below) and counts people per game.
// Role "host" is a shared TV screen, not a person, so it isn't counted.
//
// Visits: once per browser tab session a page calls the record_visit RPC, which adds 1
// to today's row for that page in public.site_visits. visit_totals / visit_daily read it.
// See docs/live-counts.md.
//
// Use from a page:
//   <script src="/live.js" data-page="home" defer></script>         count a visit to "home"
//   <script src="/live.js" data-game="my-game" defer></script>      a game: count it as a
//                                                                   player and a visit
//   SiteLive.onPlayers((counts, state, connected) => ...)   counts = { slug: people }, live
//   SiteLive.totals()  -> Promise<[{ page, total, today }]>
//   SiteLive.daily(30) -> Promise<[{ day, page, visits }]>
//   SiteLive.rpc('site_stats') -> Promise<{ games, accounts, ... }>  (the stats page)
//
// localStorage "michaelsturrup.nocount" = "1" (the switch on /stats/) skips recording visits.

(() => {
  const SB = {
    url: 'https://abeqdmurddrkrqbnfylb.supabase.co',
    key: 'sb_publishable_8WUpbX-clRvdKgset72mkQ_C_NFL5E8',
  };
  const TOPIC = 'realtime:site:presence';
  const script = document.currentScript;
  const game = script?.dataset.game || null;
  const page = script?.dataset.page || game;

  // ---- Visits -------------------------------------------------------------------

  function rpc(name, args = {}) {
    return fetch(`${SB.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    }).then((r) => (r.ok ? r.json().catch(() => null) : Promise.reject(new Error(r.status))));
  }

  function recordVisit(p) {
    try {
      if (localStorage.getItem('michaelsturrup.nocount') === '1') return; // set on /stats/
      const k = `michaelsturrup.visit.${p}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch {
      /* storage blocked: still count */
    }
    rpc('record_visit', { p_page: p }).catch(() => {});
  }

  // ---- Presence (Phoenix protocol, the same one supabase-js speaks) --------------

  const listeners = new Set();
  let state = {}; // presence key -> metas[]
  let ws = null;
  let ref = 0;
  let joinRef = null;
  let heartbeat = null;
  let retry = 0;
  const myKey = Math.random().toString(36).slice(2, 12);

  function counts() {
    const out = {};
    for (const metas of Object.values(state)) {
      const m = metas[0];
      if (!m || typeof m.g !== 'string' || m.r === 'host') continue;
      out[m.g] = (out[m.g] || 0) + 1;
    }
    return out;
  }

  let joined = false;

  function emit() {
    const c = counts();
    listeners.forEach((cb) => cb(c, state, joined));
  }

  function send(topic, event, payload, jr = joinRef) {
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ topic, event, payload, ref: String(++ref), join_ref: jr }));
  }

  function applyDiff({ joins = {}, leaves = {} }) {
    for (const [key, { metas }] of Object.entries(leaves)) {
      const gone = new Set(metas.map((m) => m.phx_ref));
      const left = (state[key] || []).filter((m) => !gone.has(m.phx_ref));
      if (left.length) state[key] = left;
      else delete state[key];
    }
    for (const [key, { metas }] of Object.entries(joins)) state[key] = [...(state[key] || []), ...metas];
  }

  function connect() {
    if (ws || typeof WebSocket === 'undefined') return;
    ws = new WebSocket(`${SB.url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${SB.key}&vsn=1.0.0`);
    ws.onopen = () => {
      retry = 0;
      joinRef = String(++ref);
      send(
        TOPIC,
        'phx_join',
        {
          config: { broadcast: { ack: false, self: false }, presence: { key: myKey, enabled: true }, postgres_changes: [], private: false },
          access_token: SB.key,
        },
        joinRef,
      );
      heartbeat = setInterval(() => send('phoenix', 'heartbeat', {}, null), 25000);
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.topic !== TOPIC) return;
      if (msg.event === 'phx_reply' && msg.ref === joinRef && msg.payload?.status === 'ok' && game) {
        send(TOPIC, 'presence', { type: 'presence', event: 'track', payload: { g: game, r: 'play' } });
      } else if (msg.event === 'presence_state') {
        joined = true;
        state = {};
        applyDiff({ joins: msg.payload });
        emit();
      } else if (msg.event === 'presence_diff') {
        applyDiff(msg.payload);
        emit();
      }
    };
    ws.onclose = () => {
      clearInterval(heartbeat);
      ws = null;
      joined = false;
      state = {};
      emit();
      if (document.visibilityState === 'hidden') return; // reconnect when the tab is back
      setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') connect();
  });

  window.SiteLive = {
    onPlayers(cb) {
      listeners.add(cb);
      connect();
      if (joined) cb(counts(), state, true);
      return () => listeners.delete(cb);
    },
    totals: () => rpc('visit_totals'),
    rpc,
    daily: (days = 30) => rpc('visit_daily', { p_days: days }),
  };

  if (page) recordVisit(page);
  if (game) connect();
})();
