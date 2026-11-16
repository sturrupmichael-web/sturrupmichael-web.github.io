// "Sign in with Google" for the whole site.
//
// Signing in here puts one Google session in localStorage under SITE_KEY. Every game on
// michaelsturrup.com shares that same slot, so a player who signs in on this page is
// already signed in when they open a game, and signing out anywhere signs out everywhere.
// docs/site-sign-in.md is the contract games follow to join in.
//
// Same Supabase project and the same no-library approach as the games: send the page to
// Supabase's /authorize, and the session comes back in the address after "#".

(() => {
  const SB = {
    url: 'https://abeqdmurddrkrqbnfylb.supabase.co',
    key: 'sb_publishable_8WUpbX-clRvdKgset72mkQ_C_NFL5E8',
    timeout: 8000,
  };
  const SITE_KEY = 'michaelsturrup.auth.v1';

  // ---- The shared session ---------------------------------------------------------
  // Always read it fresh from storage: a game in another tab may have refreshed it.

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SITE_KEY));
      return s && s.user && s.user.id && s.refresh_token ? s : null;
    } catch {
      return null;
    }
  }

  function save(s) {
    try {
      if (s) localStorage.setItem(SITE_KEY, JSON.stringify(s));
      else localStorage.removeItem(SITE_KEY);
    } catch {
      /* storage blocked: nothing to share */
    }
  }

  // id, email and the guest flag come from the access token itself.
  function fromTokens(t) {
    try {
      const claims = JSON.parse(atob(t.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!claims.sub) return null;
      return {
        access_token: t.access_token,
        refresh_token: String(t.refresh_token || ''),
        expires_at: Number(t.expires_at) || claims.exp,
        user: { id: claims.sub, email: claims.email || '', guest: !!claims.is_anonymous },
      };
    } catch {
      return null;
    }
  }

  async function request(url, opts = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), SB.timeout);
    try {
      const res = await fetch(url, {
        ...opts,
        signal: ctl.signal,
        headers: { apikey: SB.key, 'Content-Type': 'application/json', ...opts.headers },
      });
      const body = res.status === 204 ? null : await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, body };
    } catch {
      return { ok: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  const returnUrl = () => location.origin + location.pathname;

  const account = {
    lastError: '',
    get user() {
      return load()?.user ?? null;
    },
    // Sign-in needs a real top-level page on the site: Google won't show inside a frame.
    get available() {
      try {
        return window.top === window && location.protocol.startsWith('http');
      } catch {
        return false;
      }
    },

    // Picks up the tokens Supabase puts in the address after Google. 'signed-in', 'error' or null.
    init() {
      const params = new URLSearchParams(location.hash.slice(1));
      if (!params.has('access_token') && !params.has('error')) return null;
      history.replaceState(null, '', returnUrl() + location.search);
      if (params.has('error')) {
        this.lastError = (params.get('error_description') || params.get('error') || '').slice(0, 160);
        return 'error';
      }
      const s = fromTokens(Object.fromEntries(params));
      if (!s || s.user.guest) {
        this.lastError = "The sign-in came back in a form this page didn't understand.";
        return 'error';
      }
      save(s);
      return 'signed-in';
    },

    // True when there's a session good for at least another minute, refreshing it if needed.
    async ensure() {
      const s = load();
      if (!s) return false;
      if (s.expires_at - 60 > Date.now() / 1000) return true;
      const r = await request(`${SB.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      const next = r.ok && r.body ? fromTokens(r.body) : null;
      if (next) {
        save(next);
        return true;
      }
      if (r.status === 0) return false; // offline: keep it for later
      // Refused. A game may have refreshed it a moment ago: only drop it if it's unchanged.
      if (load()?.refresh_token === s.refresh_token) save(null);
      return !!load();
    },

    async rest(path, opts = {}) {
      if (!(await this.ensure())) return { ok: false, status: 401 };
      return request(`${SB.url}/rest/v1/${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${load().access_token}`, ...opts.headers },
      });
    },

    // The leaderboard name shared by all the games: a string, undefined if none yet, null if unknown.
    async name() {
      const r = await this.rest('players?select=name');
      if (!r.ok || !Array.isArray(r.body)) return null;
      return r.body[0]?.name;
    },

    // { ok } or { ok: false, taken } or { ok: false, message }.
    async setName(name, had) {
      const id = this.user?.id;
      const r = had
        ? await this.rest(`players?user_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
        : await this.rest('players', { method: 'POST', body: JSON.stringify({ name }) });
      if (r.status === 409) return { ok: false, taken: true };
      if (!r.ok) return { ok: false, message: String(r.body?.message || '').slice(0, 160) };
      return { ok: true };
    },

    signIn() {
      location.assign(`${SB.url}/auth/v1/authorize?${new URLSearchParams({ provider: 'google', redirect_to: returnUrl() })}`);
    },

    signOut() {
      const s = load();
      if (s) request(`${SB.url}/auth/v1/logout`, { method: 'POST', headers: { Authorization: `Bearer ${s.access_token}` } });
      save(null);
    },
  };

  // ---- The header control ---------------------------------------------------------

  const NAME_MAX = 16;
  const box = document.getElementById('account');
  if (!box) return;

  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  }

  function googleMark() {
    // Google's "G", drawn inline so the page needs no outside images.
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const paths = [
      ['#EA4335', 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'],
      ['#4285F4', 'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'],
      ['#FBBC05', 'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'],
      ['#34A853', 'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'],
    ];
    for (const [fill, d] of paths) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('fill', fill);
      p.setAttribute('d', d);
      svg.append(p);
    }
    return svg;
  }

  function note(text, cls = 'account-note') {
    return el('p', { class: cls, role: cls.includes('error') ? 'alert' : 'status' }, text);
  }

  function renderSignedOut(error) {
    const btn = el('button', { type: 'button', class: 'google' });
    btn.append(googleMark(), el('span', {}, 'Sign in with Google'));
    btn.addEventListener('click', () => account.signIn());
    const parts = [btn, note('One sign-in for the games here, and your leaderboard name follows you.')];
    if (error) parts.push(note(`Sign-in didn't finish: ${error}`, 'account-note account-error'));
    box.replaceChildren(...parts);
  }

  function signOutButton() {
    const out = el('button', { type: 'button', class: 'link' }, 'Sign out');
    out.addEventListener('click', () => {
      account.signOut();
      render();
    });
    return out;
  }

  function nameForm(had) {
    const form = el('form', { class: 'name-form', novalidate: '' });
    const id = 'account-name';
    const input = el('input', { id, type: 'text', maxlength: String(NAME_MAX), autocomplete: 'nickname', spellcheck: 'false', required: '' });
    if (had) input.value = had;
    const msg = el('p', { class: 'account-note', role: 'status' });
    form.append(
      el('label', { for: id }, had ? 'Leaderboard name' : 'Pick a leaderboard name'),
      input,
      el('button', { type: 'submit', class: 'small' }, 'Save'),
    );
    if (had) {
      const cancel = el('button', { type: 'button', class: 'link' }, 'Cancel');
      cancel.addEventListener('click', () => render());
      form.append(cancel);
    }
    form.append(msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) {
        msg.textContent = 'Type a name first.';
        return;
      }
      if (name === had) return render();
      msg.textContent = 'Saving…';
      const r = await account.setName(name, had);
      if (r.ok) return render();
      msg.textContent = r.taken ? 'Someone already has that name. Try another.' : r.message || "Couldn't save it. Try again in a moment.";
    });
    return form;
  }

  async function render(error) {
    const user = account.user;
    if (!user) return renderSignedOut(error);

    const who = el('p', { class: 'badge' });
    const label = el('span', {}, 'Signed in as ');
    const strong = el('strong', {}, user.email || 'you');
    who.append(label, strong);
    box.replaceChildren(who, signOutButton());

    const name = await account.name();
    if (!account.user) return renderSignedOut(); // the session lapsed while asking
    if (name === undefined) {
      box.replaceChildren(who, signOutButton(), nameForm());
      setTimeout(() => box.querySelector('input')?.focus(), 0);
      return;
    }
    if (name) {
      strong.textContent = name;
      who.title = user.email;
      const change = el('button', { type: 'button', class: 'link' }, 'Change name');
      change.addEventListener('click', () => {
        box.replaceChildren(who, nameForm(name));
        box.querySelector('input')?.select();
      });
      box.replaceChildren(who, change, signOutButton());
    }
  }

  if (!account.available) return; // in a frame or a saved copy: leave the header as it is
  box.hidden = false;
  const came = account.init();
  render(came === 'error' ? account.lastError : '');

  // Signed in or out in another tab (or a game): follow along.
  window.addEventListener('storage', (e) => {
    if (e.key === SITE_KEY || e.key === null) render();
  });
})();
