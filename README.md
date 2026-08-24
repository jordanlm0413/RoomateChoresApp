# Roomie Rhythm

A shared chore board with real accounts, homes, and invites — built for **Cloudflare Pages** (static frontend) + **Pages Functions** (serverless API) + **D1** (SQLite-compatible database).

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
4. Run the site locally (serves static files + Functions + local D1):
   ```
   wrangler pages dev . --d1=DB=roomie-rhythm-db
   ```
   Then open the printed `http://localhost:8788` URL.

## Deploying

```
wrangler pages deploy .
```

Make sure the `DB` binding is configured in the Cloudflare Pages dashboard (Settings → Functions → D1 database bindings) pointing at `roomie-rhythm-db`, or it will be picked up automatically from `wrangler.toml` when deploying via Wrangler.

## Project structure

- `index.html`, `auth.js`, `auth.html`, `app.js`, `styles.css` — static frontend served directly by Pages
- `functions/api/**` — Pages Functions (serverless API routes), file-based routing
- `functions/_lib/auth.js` — shared password hashing, session, and auth-guard helpers (not routable, underscore-prefixed)
- `schema.sql` — D1 database schema
- `wrangler.toml` — Pages project + D1 binding config
