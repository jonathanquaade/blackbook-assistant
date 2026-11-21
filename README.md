# Blackbook

Blackbook is Jonathan's private collection of creative talent. Describe a project, shortlist people by the work they have actually done, and review new or changed entries before they appear in search.

| Part | What's here today |
|---|---|
| **Web app** | [Explore, Review and Shortlist](web/src/app) in Next.js and TypeScript. They use fixtures and browser-local state, with no live index, Notion writes, or production authentication. |
| **Keeper** | [Python tools](scripts) for the Notion Companies database, a [studio roster](state/roster), and [agent runbooks](.claude/agents). This is the existing intake and enrichment system. |
| **Search benchmark** | [Twenty representative briefs](blackbook/shortlist-benchmark.md). Re-score against the eligibility rule below before using it as a release gate. |

## Run the frontend locally

Use Node.js 24 (the version used by [web CI](.github/workflows/web.yml)). No accounts or API keys are needed for the fixture app.

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000. From `web/`, run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` to reproduce web CI. For the live CLI, read [the Keeper contract](CLAUDE.md) before running anything that may write to Notion.

## Where we're going

- **Search:** Only Jonathan-Verified entries that he rated **4 or 5**. Precompute entry embeddings and keyword indexes. Embed the brief once and let Postgres find matches; no generative model reads the catalog at query time.
- **Review:** See the work and evidence, then approve, reject, or request a targeted change. Jonathan alone verifies entries and controls ratings.
- **Intake:** Scout maintains the database and studio roster. Scraper captures work for eligible jobs. An independent Portfolio Reviewer checks evidence before Jonathan sees it. None of them runs when someone searches.

Start with the [Blackbook product and operating spec](blackbook/SPEC.md) for rollout gates, Scout/Scraper cadence, and model spend. The existing [Keeper plan](PLAN.md) and [Notion assistant spec](SPEC-notion-creative-assistant.md) document the older CLI work, not the new platform rollout.
