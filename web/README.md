# Blackbook web

`npm run dev` serves the fixture preview by default.

## Live Explore (stage 1)

1. Use Node 24. Set `NOTION_API_KEY` and a long, unique `BLACKBOOK_OWNER_PASSWORD` in the runtime environment or in the repository-root, gitignored `.env`. Exported values take precedence. Optionally set `NOTION_DATABASE_ID` to override the Companies database.
2. Run `npm ci`, `npm run build` and `npm run start:live` inside `web/`. Serve from a single always-on Node process with persistent storage for `.data/` (or set `BLACKBOOK_DATA_DIR` to an absolute persistent path). Do not use a serverless deployment for live mode.
3. Open `/explore` and sign in as `jonathan` with the configured password. Without an owner password, deployment exposes only sandbox fixtures and the live APIs are disabled.

- The backend listens on loopback only. For remote access, put a trusted HTTPS reverse proxy in front of it, redirect HTTP at the proxy, and have the proxy overwrite client-supplied `X-Forwarded-Proto` with the actual protocol. Never expose the backend port. For local testing without a reverse proxy, set `BLACKBOOK_ALLOW_HTTP_LOOPBACK=1` and open the app on `127.0.0.1`.
- Live startup syncs immediately and again 15 minutes after each run finishes. Set `BLACKBOOK_SYNC_MINUTES` to override that interval. Sync uses a read-only Notion query, then rebuilds a local snapshot. Only Verified entries rated 4 or 5 appear; a new clip stays out until Jonathan verifies and rates it. A failed sync retains the last good snapshot and logs the failure.
- `npm run sync` is available for manual recovery when the live process is stopped. Never run multiple writers against the same data directory.
- The index is Postgres with pgvector, embedded via PGlite, so no database server is needed. Embeddings come from `bge-small-en-v1.5` run locally, so no API key and nothing leaves the machine. Only names, roles, capabilities and project captions are embedded; Notes, contacts, rates and relationship fields are never read into the index.
- Unchanged entries reuse their embeddings (keyed by content hash and model version).
- Images are served through `/api/media` using short-lived signed Notion links, checked against the current eligibility list with a one-minute cache invalidated on every successful sync. A Notion URL already issued remains valid until Notion expires it.
- `npm run eval` scores keyword-only and hybrid search on `blackbook/shortlist-benchmark.json` and writes `blackbook/stage1-eval.md`.
