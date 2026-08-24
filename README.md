# Roomie Rhythm

A shared chore board with real accounts, homes, and invites — built as a single **Cloudflare Worker** that serves the static frontend (via the `assets` binding) and a JSON API (via a manual `/api/*` router), backed by **D1** (SQLite-compatible database).

## Features

- Sign up / sign in with a unique username + password (passwords hashed with PBKDF2 via Web Crypto, never stored in plain text)
- Create one or more "homes"
- Invite roommates into a home either by sharing the home's invite code, or by inviting an existing username directly
- Chores are scoped per-home, visible to all members of that home
- Sessions via secure, httpOnly cookies stored in D1

## Local development

1. Install [Node.js](https://nodejs.org/) and the Wrangler CLI:
   ```
   npm install -g wrangler
   ```
2. Log in to Cloudflare and create a D1 database:
   ```
   wrangler login
   wrangler d1 create roomie-rhythm-db
   ```
   Copy the `database_id` from the output into [wrangler.toml](wrangler.toml).
3. Apply the schema locally and remotely:
   ```
   wrangler d1 execute roomie-rhythm-db --local --file=./schema.sql
   wrangler d1 execute roomie-rhythm-db --remote --file=./schema.sql
   ```
4. Run the site locally:
   ```
   wrangler dev
   ```
   Then open the printed `http://localhost:8787` URL.

## Deploying

```
wrangler deploy
```

In the Cloudflare dashboard, make sure your project's **Deploy command** (Settings → Builds) is `npx wrangler deploy` (this is a Worker, not a classic Pages project) and that the `DB` D1 binding is configured (Settings → Bindings), or it will be picked up automatically from `wrangler.toml` when deploying via Wrangler.

## Project structure

- `index.html`, `auth.js`, `auth.html`, `app.js`, `styles.css` — static frontend served by the Worker's `assets` binding
- `src/index.js` — Worker entry point: routes `/api/*` requests, otherwise falls through to static assets
- `src/lib/auth.js` — password hashing, session, and auth-guard helpers
- `schema.sql` — D1 database schema
- `wrangler.toml` — Worker + assets + D1 binding config
- `.assetsignore` — excludes source/config files (and `.git`) from being uploaded as public static assets
