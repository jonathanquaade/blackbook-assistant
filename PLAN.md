# PLAN — Building "The Keeper"

Working plan for implementing [SPEC-notion-creative-assistant.md](SPEC-notion-creative-assistant.md).
Database: Notion "Companies" DB — id `50cacdf602f64685942a55d26caa27a9`
(view `221a8306254a42469c367d9353d1e3c7`).

## Stack decision

Keep the spec's stack exactly — it already matches Jonathan's skills and the
beginner-friendly constraint:

- **TypeScript scripts** (`scripts/*.ts`, run with `npx tsx`) using the official
  `@notionhq/client` SDK. No framework, no server, no deploy.
- **Notion is the only database and the only UI.** No Next.js app, no Supabase/Railway
  in v1 — there is nothing to host. Revisit only if "The List" app happens later (then:
  Next + Sanity-style pattern on Vercel + R2 for images, per spec §5).
- **Claude in Chrome** for browser work (Instagram/LinkedIn/portfolios), riding
  Jonathan's logged-in sessions per spec §4.
- **Local repo folders** for assets, state, provenance, backups.

## Prerequisites (Jonathan)

| # | What | Needed by | Status |
|---|------|-----------|--------|
| 1 | Create `.env` in this repo: `NOTION_API_KEY=...` (it's gitignored; never paste the key in chat) | Phase 0 | ✅ 2026-06-12 (integration: `blacbook-assistant`) |
| 2 | In Notion: open the Companies DB → ⋯ → Connections → add the integration the key belongs to | Phase 0 | ✅ 2026-06-12 |
| 3 | Claude in Chrome extension installed + connected | Phase 1 | ☐ (not connected as of 2026-06-12) |
| 4 | Turbo Downloader for Instagram extension installed | Phase 1 | ☐ |
| 5 | Decide: commit `assets/` to git, or sync via iCloud/Dropbox and gitignore it | Phase 1 | ☐ |
| 6 | Create saved views from the checklist (📥 Review etc.) | Phase 1 | ☐ |
| 7 | Work through the 53 entries in 📥 Review (migration questions) | Phase 1 | ☐ |

**Phase 0: ✅ COMPLETE 2026-06-12.** Repo: github.com/jonathanquaade/blackbook-assistant
(private). Implementation notes: Notion API silently ignores select-option renames
(re-apply as per-row value rewrites + option deletion); option names match
case-insensitively (case-only renames collide); deleted property names stay reserved
(reverse relation is "Works Here", not "People").

## Phase 0 — Schema & migration (one session, API only, no browser)

1. **Inspect live schema**: retrieve the DB via API; dump current properties + option
   lists to `backups/schema-before.json`. Reconcile the spec's "exists" assumptions
   (Name, Day Rate, Website, Instagram, Country, Expertise, crmStatus, Bucket,
   Relationship) against reality.
2. **Backup**: export all rows to `backups/YYYY-MM-DD.csv` (script, not Notion's manual
   export — repeatable before every future bulk op). Commit.
3. **Add new properties** (non-destructive): Type, Work Status, Works At (relation,
   self), Works At Link, Autonomy, LinkedIn, Size, Worked Together, Familiarity,
   Word of Mouth, Work With?, Rating, Rating Notes, Source, Images, Open Questions,
   AI Notes, Status Last Verified, Entry Status. Rename Expertise → Capabilities
   (keeps data).
4. **Tag mapping proposal**: tally current Expertise tags → propose Capabilities
   mapping as a table for approval. Apply only after explicit yes.
5. **Relationship/CRM mapping proposal**: map old Relationship/crmStatus/Bucket values
   per spec §2 migration step 4; flag entries needing Jonathan's own Work With?/Rating.
   Apply approved mapping; never pre-fill the five relationship dimensions.
6. **Mechanical passes**: Size=1 for Persons; employer info → Works At / Works At Link;
   report shared external employers as add-candidates.
7. **Retire CRM-era properties** after mapping is applied (values preserved in CSV).
8. **Init state**: `state/provenance/<page-id>.json` for every row
   (`set_by: jonathan`, unverified); all entries → `Entry Status = Stale`.
9. **Write TAXONOMY.md v1** from the approved tag mapping.
10. **Saved views** (manual, Jonathan, ~5 min with my checklist): Dream partners,
    Proven core, Never again, Needs Review queue.

Exit criteria: spec §9 Phase 0 ✓s, plus `schema-before.json` committed.

## Phase 1 — Intake (P1)

- `scripts/notion.ts`: thin client — query by Entry Status, read/write properties,
  file upload (Images property + page-body blocks), provenance read/write helpers.
- `scripts/intake.ts`: produce the work list (entries `New` or missing critical
  fields); Claude Code does the judgment per CLAUDE.md + TAXONOMY.md.
- Browser playbooks per spec §4: portfolio scrape first, Instagram capture
  (Turbo Downloader), LinkedIn snippets-first. Hard guardrails §4.0 verbatim
  in CLAUDE.md.
- `assets/<page-id>/` + `manifest.json` per image; upload via Notion file-upload API.
- Write CLAUDE.md (operating instructions distilled from spec) at the start of this
  phase — it is what future sessions actually follow.
- Acceptance: bare clipped entry → full draft profile w/ images + Open Questions in
  Needs Review, <3 min agent time.

## Phase 2 — Verification (P2)

- `scripts/verify.ts`: select ≤10 entries by `Status Last Verified` age + Stale,
  fair rotation via `state/verify-cursor.json`.
- Diffs as proposals in Open Questions; provenance updated per field; date bumped
  only when whole entry checks out. LinkedIn ≤5/run, snippets first.

## Phase 3 — Scout (P3)

- `sources.md` v1 (It's Nice That, BP&O, Brand New, Fonts In Use + Jonathan's adds).
- Create **Candidates** DB (same schema) — needs Jonathan's yes on location/parent page.
- `scripts/scout.ts`: crawl since `state/scout-last-run.json`, dedupe (name+domain
  fuzzy), mini-enrich, digest message. Yes → move to main DB + run P1; No → Rejected.

## Phase 4 — Learning (ongoing)

- Correction detection on reviewed entries → `state/corrections.jsonl`.
- Distillation at ≥15 corrections or quarterly → TAXONOMY.md diff for approval.
- `scripts/taxonomy.ts`: tag stats, co-occurrence, split/merge proposals (P4 report,
  includes override-rate metric).

## Phase 5 — Project shortlists (deferred, design agreed 2026-06-12)

- New **Projects** database with a relation to Companies ("Shortlist"); reverse
  relation on entries shows "Shortlisted for". Replaces the one-checkbox-per-project
  pattern (For Fuse, For WF — left untouched until this phase, then migrated into
  the first two project pages and retired).
- A future frontend ("The List") would read this same structure; build Notion-native
  first.

## Conventions (agreed 2026-06-12)

- **Fields filter, pages read.** Anything worth sorting/filtering lives in a property;
  long-form context lives in the page body. `Notes` property = one-line headline,
  Jonathan-owned.
- **Page body layout:** agent-owned image section at top, then a divider; everything
  below the divider is Jonathan's — agent reads it for signals, never writes there.
- **One review inbox:** saved view "📥 Review" = `Entry Status: Needs Review`. Every
  pipeline that needs Jonathan's eyes routes through it via Entry Status + Open
  Questions. Views are created by hand (API can't), checklist provided.

## Open questions for Jonathan

1. Assets storage: commit to git or iCloud/Dropbox sync? (prereq #5)
2. Where should the Candidates DB live (same Notion page as Companies, or elsewhere)?
3. Is the linked DB the only one in scope, or are there sibling DBs (e.g. an old
   contacts table) whose data should be folded in during migration?
