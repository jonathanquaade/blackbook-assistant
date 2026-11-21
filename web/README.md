# Blackbook web

`npm run dev` serves the app. Explore uses your live Notion catalog once an index exists, otherwise the fixture preview.

## Live Explore (stage 1)

- `npm run sync` reads the Notion database (read only, needs `NOTION_API_KEY`) and rebuilds the local search index in `.data/`. Only entries that are Verified and rated 4 or 5 go in. A failed sync keeps the last good index.
- The index is Postgres with pgvector, embedded via PGlite, so no database server is needed. Embeddings come from `bge-small-en-v1.5` run locally, so no API key and nothing leaves the machine. Only names, roles, capabilities and project captions are embedded; Notes, contacts, rates and relationship fields are never read into the index.
- Unchanged entries reuse their embeddings (keyed by content hash and model version).
- Images are served through `/api/media`, which redirects to a fresh signed Notion link for eligible entries only.
- `npm run eval` scores keyword-only and hybrid search on `blackbook/shortlist-benchmark.json` and writes `blackbook/stage1-eval.md`.
