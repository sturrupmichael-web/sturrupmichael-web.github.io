# One Google sign-in for the whole site

The main page (`account.js`) has a **Sign in with Google** button. It keeps the
signed-in session in `localStorage` under one key that every game on
`https://michaelsturrup.com` can share:

```
michaelsturrup.auth.v1
```

So a player who signs in on the main page is already signed in when they open a game,
and signing out anywhere signs them out everywhere.

## The session

JSON, in the same shape the games already use:

```json
{
  "access_token": "…",
  "refresh_token": "…",
  "expires_at": 1763300000,
  "user": { "id": "uuid", "email": "someone@gmail.com", "guest": false }
}
```

It is always a Google account (never a guest). Same Supabase project as every game:
`https://abeqdmurddrkrqbnfylb.supabase.co`.

## How a game joins in

1. **Use the shared key for Google sign-ins.** Read and write the session at
   `michaelsturrup.auth.v1` instead of a key of the game's own. Keep guest accounts
   under the game's own key: a guest belongs to one game, a Google account to the site.
2. **Read it fresh from storage before each use**, not once at load. Supabase gives out
   a new refresh token every time a session is refreshed and the old one stops working,
   so a copy kept in memory (or under another key) goes stale as soon as another page
   refreshes it. Whoever refreshes writes the new session straight back to the key.
3. **When a refresh is refused, check before signing out.** If the key now holds a
   different refresh token, another page refreshed it first: use that one.
4. **Signing out removes the key.** That signs the player out of every game.
5. Listen for the `storage` event on the key to follow sign-ins and sign-outs made in
   other tabs (optional).

The leaderboard name is already shared: it's the `players` row for the account's user
id, which every game reads.

## What can't share it

The browser keeps `localStorage` separately for each address. A game served from a
different address, such as `https://game.michaelsturrup.com`, can't see the main page's
sign-in. It needs its own Sign in with Google, or to move under
`https://michaelsturrup.com/…`.

## Sign-in addresses

Google sends players back to the page they signed in from. Supabase only allows that
for addresses in **Authentication → URL Configuration → Redirect URLs**;
`https://michaelsturrup.com/**` covers the main page and every game under it.
