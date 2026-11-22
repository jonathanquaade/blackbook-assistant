# Blackbook web

`npm run dev` serves the fixture preview by default.

## Live Explore (stage 1)

Live mode shows Jonathan's real Notion entries, owner-only. Only Verified entries rated 4 or 5 ever appear. Without a valid owner password the app serves only sandbox fixtures and the live APIs return 404. **BLACKBOOK_OWNER_PASSWORD must be at least 20 characters**; a shorter one disables live mode and logs why. Wrong passwords are delayed per client address, in memory only (on serverless this resets when an instance is recycled, so it slows guessing and nothing more; the long password is the real protection).

There are two ways to run it. Use Node 24 for both.

### On Vercel (serverless)

How it works: the build reads Notion read-only, embeds passages with the pinned local model (`bge-small-en-v1.5`, no external provider) and writes `.blackbook-index/index.json` into the deployment (gitignored, never committed). It holds only names, roles, capabilities, locations, project captions and image file names. Each search loads that file in memory and ranks by keyword plus cosine similarity. Before returning anything it intersects the results with a fresh list of eligible pages (one read-only Notion query, cached for 60 s). A downgrade or rejection therefore applies within a minute with no rebuild. If that query fails, the last answer is reused for up to 5 minutes, then search returns 503 and shows nothing. New eligible entries, new projects and edits appear on the next deploy (hourly, see below).

The query embedding uses the model inside the function (cached in `/tmp`, or bundled if the build could fetch it). If it is not ready within 8 s, that search runs keyword-only and the response says so (`mode`, `modeReason`). With no Notion variables at build time the app builds with live mode off; it never falls back to fixtures while live mode is on. If live mode is on but the build produced no index, search returns 503 and the Explore page says so.

Vercel project settings (Project, Settings, Environment Variables), for **Production and Preview**:

- `NOTION_API_KEY`: a read-only Notion integration secret shared with the Companies database (notion.so/profile/integrations, create an internal integration with "Read content" only, then share the database with it).
- `NOTION_DATABASE_ID`: optional, overrides the Companies database id.
- `BLACKBOOK_OWNER_PASSWORD`: 20+ random characters (for example `openssl rand -base64 24`). Sign in as `jonathan`.

Marking these three **Sensitive** is fine and recommended: the preview workflow no longer uses `vercel pull`, it deploys source and Vercel builds it remotely, where Sensitive values are available. Keep "Include source files outside of the Root Directory in the Build Step" enabled (the default), because the build reads `assets/<page-id>/manifest.json` from the repository root.

GitHub repository secrets (Settings, Secrets and variables, Actions):

- `VERCEL_TOKEN`: vercel.com/account/tokens, create a token scoped to the team. Preview deploys skip cleanly while it is unset.
- `VERCEL_ORG_ID`: the team id (`team_K6xyLljJE5ySUnsVdYU64LFZ`; Team Settings, General).
- `VERCEL_PROJECT_ID`: `prj_oez3KUTls3SBkQT5srTMMvrivzDV` (Project Settings, General).
- `VERCEL_DEPLOY_HOOK`: Project Settings, Git, Deploy Hooks, create a hook on `main`, paste its URL. The hourly workflow `vercel-redeploy.yml` posts to it (also runnable by hand) and skips cleanly if the secret is absent.

Preview deploys: pushing a `claude/**` or `devin/**` branch runs `.github/workflows/vercel-preview.yml`, which runs `vercel deploy` from the repository root (no `--prebuilt`, no local build, no environment pull) so the build happens on Vercel with the real Preview environment, because the Git integration refuses commits not authored by the team owner. The root `.vercelignore` limits the upload to `web/` source and `assets/*/manifest.json`; backups, state, scripts, images and env files are never uploaded. The job summary shows the URL and the build's "Index built" or "Index build skipped" line (from `vercel inspect --logs`), and a pull request gets a comment with the URL. Vercel Deployment Protection may add its own login in front of the app's password.

**Security:** the Notion key no longer reaches GitHub runners; only `VERCEL_TOKEN` does, and only on the deploy and report steps. Anyone who can push to a `claude/**` or `devin/**` branch can still run branch code inside Vercel's build with the Preview environment variables, so the Preview environment's Notion integration must be a separate, read-only one (read content only).

Not verified yet: the deployed function size (onnxruntime-node and the model; other platforms' binaries are excluded in `next.config.ts`) and the first-request model load time on Vercel. If search is keyword-only in production, check `modeReason` in the response.

### Self-hosted (one always-on process)

1. Set `NOTION_API_KEY` and `BLACKBOOK_OWNER_PASSWORD` in the runtime environment or in the repository-root, gitignored `.env`. Exported values take precedence. Optionally set `NOTION_DATABASE_ID`.
2. Run `npm ci`, `npm run build` and `npm run start:live` inside `web/`. Serve from a single always-on Node process with persistent storage for `.data/` (or set `BLACKBOOK_DATA_DIR` to an absolute persistent path). Set `BLACKBOOK_INDEX_MODE=bundle` and run `npm run build:index` if you would rather use the Vercel-style bundled index here.
3. Open `/explore` and sign in as `jonathan` with the configured password.

- The backend listens on loopback only. For remote access, put a trusted HTTPS reverse proxy in front of it, redirect HTTP at the proxy, and have the proxy overwrite client-supplied `X-Forwarded-Proto` with the actual protocol. Never expose the backend port. For local testing without a reverse proxy, set `BLACKBOOK_ALLOW_HTTP_LOOPBACK=1` and open the app on `127.0.0.1`.
- Live startup syncs immediately and again 15 minutes after each run finishes. Set `BLACKBOOK_SYNC_MINUTES` to override that interval. Sync uses a read-only Notion query, then rebuilds a local snapshot. Only Verified entries rated 4 or 5 appear; a new clip stays out until Jonathan verifies and rates it. A failed sync retains the last good snapshot and logs the failure.
- `npm run sync` is available for manual recovery when the live process is stopped. Never run multiple writers against the same data directory.
- Self-hosted only: the index is Postgres with pgvector, embedded via PGlite, so no database server is needed. Embeddings come from `bge-small-en-v1.5` run locally, so no API key and nothing leaves the machine. Only names, roles, capabilities and project captions are embedded; Notes, contacts, rates and relationship fields are never read into the index.
- Unchanged entries reuse their embeddings (keyed by content hash and model version).
- Images are served through `/api/media` using short-lived signed Notion links, checked against the current eligibility list with a one-minute cache invalidated on every successful sync. A Notion URL already issued remains valid until Notion expires it.
- `npm run eval` scores keyword-only and hybrid search on `blackbook/shortlist-benchmark.json` and writes `blackbook/stage1-eval.md`.
