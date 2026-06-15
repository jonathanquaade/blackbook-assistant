# PLAN — Building "The Keeper"

Working plan for implementing [SPEC-notion-creative-assistant.md](SPEC-notion-creative-assistant.md).
Database: Notion "Companies" DB — id `50cacdf602f64685942a55d26caa27a9`
(view `221a8306254a42469c367d9353d1e3c7`).

## ▶ CURRENT STATE & NEXT STEPS (read first — updated 2026-06-15)

**We are deep in the Stage A backfill, doing it MANUALLY in batches of ~5.**
Jonathan reviews each batch and sends misses back to Revisit with notes in Open
Questions; the next pass acts on them and flips back to Needs Review. This manual
phase is deliberate — it is the spec-gathering for the Stage B automation.

**Status (2026-06-15):** 717 entries — 12 Verified, 13 Needs Review, 692 Revisit;
~26 enriched (have AI Notes). The priority pool is the **~74 Notes-people**
(Entry Status = Revisit, Notes not empty, AI Notes empty) — entries where Jonathan
left a note, so the highest decision-value.

**What the next agent does:**
1. `git pull` first (CI commits backups to main).
2. Continue the backfill on the Notes-people pool (query: Entry Status=Revisit AND
   Notes not empty AND AI Notes empty). Batches of ~5.
3. Follow the CLAUDE.md P1 runbook EXACTLY. Read `state/backfill-learnings.md`
   first — it is the running log of methods + edge cases.
4. After each batch: `keeper.py stamp-verified`, commit, push. Report to Jonathan.
5. **Drain the IG queue** (`state/ig-queue.json`, currently 4: Hakan, Leonard,
   Kate, Surya) once the IG session is rested. IG SOFT-THROTTLES under rapid
   automated access, so do ONE gentle `ig.py grab` per profile, spaced out. Login
   is already done (`state/ig-profile/`, gitignored).

**Tooling already built (use these, do not reinvent):**
- `keeper.py` — work/get/set (`--from-jonathan`), `set-notes` (relocate his body
  words → Notes), ask, status, `stamp-verified`, `upload` (images + embeds +
  bookmarks + video), `body-reset`, log. Every Notion write goes through it.
- `scrape.py` — static scrape; `--render` (Playwright JS sites + `--passcode`);
  `shot` (website/IG context screenshots, auto-dismisses cookie banners); Figma via
  REST API (`FIGMA_API_KEY` in .env).
- `ig.py` — `login` (done) / `status` / `grab` (full-res IG images + video,
  read-only, caps + pause-on-challenge). Logged-out IG is capped at 640px; use
  ig.py when quality/video matters.

**Key methods (full detail in CLAUDE.md):**
- PRIMARY work discovery: find their projects → go to the agencies/brands they
  worked at → take images/video from THERE (own sites are often dead/stale/gated).
- A missing link is a skipped search: hunt for a real website (not IG/Behance-only);
  find real IG via their own Behance/site external-links + VERIFY the handle is the
  right person (wrong-person IGs bit twice). If unconfirmable, ask.
- Non-image work (sound/video/writing) → embeds/bookmarks + thumbnails; every entry
  still gets images + website/IG context shots; record seniority + set Autonomy.
- Blocked work (locked site, gated portfolio, unconfirmable IG): document in AI
  Notes, ask Jonathan if he can unlock, queue IG, still flip to Needs Review.

**In flight:** batch 5 was queued as tasks (Poolsuite Partners [studio], Harry Boyd,
Monty Hayton, Henry Heffernan, Jean Reynaud) but NOT started — next agent can do
these or pick fresh from the pool.

**Open review questions for Jonathan:** Hakan (employer: Ruiin vs Bakken & Bæck),
Claudia (Familiarity — did he work with her?), plus assorted Work With?/Rating.

**Deferred (not built yet):** Stage B cloud routines + push digest, P2 upkeeper,
P3 scout, the review app. Note: the formal `backfill-queue.json` was never built —
we pull the Notes-people pool by query instead, which works fine.

## Stack decision

Keep the spec's stack exactly — it already matches Jonathan's skills and the
beginner-friendly constraint:

- **TypeScript scripts** (`scripts/*.ts`, run with `npx tsx`) using the official
  `@notionhq/client` SDK. No framework, no server, no deploy.
- **Notion is the only database and the only UI.** No Next.js app, no Supabase/Railway
  in v1 — there is nothing to host. Revisit only if "The List" app happens later (then:
  Next + Sanity-style pattern on Vercel + R2 for images, per spec §5).
- **Browser work**: scrape.py for static sites, Playwright for JS-rendered sites,
  passcoded case studies and Instagram (persistent profile). The Claude in Chrome
  extension path is PARKED (see "Browser strategy" below).
- **Local repo folders** for assets, state, provenance, backups.
- **Background execution**: Claude cloud routines (/schedule) so pipelines run
  without Jonathan opening anything; GitHub Actions is the fallback runner. See
  "Long-term architecture".

## Prerequisites (Jonathan)

| # | What | Needed by | Status |
|---|------|-----------|--------|
| 1 | Create `.env` in this repo: `NOTION_API_KEY=...` (it's gitignored; never paste the key in chat) | Phase 0 | ✅ 2026-06-12 (integration: `blacbook-assistant`) |
| 2 | In Notion: open the Companies DB → ⋯ → Connections → add the integration the key belongs to | Phase 0 | ✅ 2026-06-12 |
| 3 | Claude in Chrome extension installed + connected | Phase 1 | ✅ 2026-06-12 (via Dia) |
| 4 | Turbo Downloader for Instagram extension installed | Phase 1 | ✅ per Jonathan (in Dia) |
| 5 | Decide: commit `assets/` to git, or sync via iCloud/Dropbox and gitignore it | Phase 1 | ☐ |
| 6 | Create saved views from the checklist (📥 Review etc.) | Phase 1 | ✅ 2026-06-12 |
| 7 | Review queue — DEFERRED by Jonathan until enrichment automation reduces it to pure judgment calls; agent enriches factual fields on Needs Review entries first | — | ⏸ |
| 8 | Playwright installed (`pip install playwright` + chromium) | Stage A | ☐ |
| 9 | Instagram: log into the persistent Playwright profile once (his account now, scouting account later) | Stage A | ☐ |

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
   (`set_by: jonathan`, unverified); all entries → `Entry Status = Revisit`.
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

## Phase 2 — Verification (P2, the upkeeper; runs as a weekly routine in Stage B)

- Batch ≤10, rotation cursor in `state/verify-cursor.json`: oldest `Status Last
  Verified` first, never-verified counts as oldest.
- Per entry, check live facts against stored: website alive and still theirs
  (redirects, domain drops, rebrands); employer still current (site/about +
  Google snippets; LinkedIn page visits ≤5/run, snippets first, they don't
  count); work status drift (went freelance, joined a studio, studio dissolved);
  link rot (IG handle changes, dead LinkedIn, bounced email domains); new work
  worth capturing → image proposals, never silent additions.
- Output discipline: clean entry → bump Status Last Verified only. Any diff →
  numbered proposal in Open Questions, entry → Needs Review, NEVER overwritten
  (`set_by: jonathan` doubly so). >90d unverified → Revisit automatically.
- Digest line: "P2: 10 checked, 2 diffs proposed."

## Phase 3 — Scout (P3; weekly routine, starts after backfill ≥ 50%)

- `sources.md` v1 (It's Nice That, BP&O, Brand New, Fonts In Use + Jonathan's
  adds); per-source last-seen cursor in `state/scout-last-run.json`.
- **Candidates DB**: same schema, sibling database on the Companies page
  (Jonathan default 2026-06-12, overridable). Created once via API. Rejected is
  permanent and lives here; never re-propose.
- Run shape: crawl new posts since cursor → extract names/studios → dedupe
  against Companies AND Candidates AND Rejected (name + domain fuzzy) →
  mini-enrich survivors (site, IG link, country, 2–3 images, one hedged line on
  why interesting) → digest push: "P3: 6 candidates, 2 strong" with names.
- Verdicts (Notion now, review app later): Yes → page moves to Companies as
  `New`, next P1 routine picks it up. No → Rejected forever.

## Phase 4 — Learning (ongoing)

- Correction detection on reviewed entries → `state/corrections.jsonl`.
- Distillation at ≥15 corrections or quarterly → TAXONOMY.md diff for approval.
- `scripts/taxonomy.ts`: tag stats, co-occurrence, split/merge proposals (P4 report,
  includes override-rate metric).

## Long-term architecture & roadmap (Jonathan approved 2026-06-12)

End state: Jonathan never needs Claude Code or Claude open. Pipelines run in the
background on a schedule; he gets a push notification when there is something to
review; long term he reviews in a web app that also serves search, portfolios,
shortlists, collaborator accounts and an AI advisor.

**Four layers:**
1. **Data**: Notion stays the single source of truth as long as possible. assets/
   + state/ in git. Images sync to Cloudflare R2 only when the web app ships
   (spec §5). No second database until Notion API limits actually hurt.
2. **Agents**: P1–P4 stay Claude Code sessions driven by CLAUDE.md, moved from
   manual terminal runs to scheduled cloud routines (/schedule). GitHub Actions
   is the fallback runner if the cloud env can't run Playwright or reach Notion.
3. **Notification**: every pipeline run ends with a push digest (entries
   processed, questions waiting, deep link to 📥 Review).
4. **Interface**: Notion is the UI now; a Next.js review app replaces the review
   flow (Stage C); that app grows into "The List" (Stage D).

DB reality at decision time: 713 entries; 658 Revisit, 53 Needs Review, 2 unset.
712 missing Type and AI Notes, 713 missing images, 651 missing Instagram. The
backfill IS the project for the next month.

### Stage A — unblock, backfill, notify (now, ~6 weeks)

> STATUS 2026-06-15: A1 DONE (Playwright + ig.py + Figma API all built). A2 IN
> PROGRESS (manual batches, ~26 enriched). A3 digest NOT built yet. See "CURRENT
> STATE" at top. backfill-queue.json was not built — we query the Notes-people pool.

**A1. Browser unblock.** Install Playwright. Two modes: headless no-profile
(passcoded case studies via state/passcodes.json, Framer/JS sites, public Figma;
live test: branevsky.com/warden) and a persistent profile Jonathan logs into
Instagram with ONCE (his account now, migrate to a separate scouting account
later; profile dir gitignored; caps unchanged: ≤10 IG profiles/run, 2–6 s waits,
any challenge pauses the whole batch). Playwright strategies land in the tools
(scrape.py or sibling browse.py), lessons in docstrings.

**A2. The backfill.** All 713 entries through a full P1-quality pass, then Needs
Review. Order: Jonathan-signal entries first (Notes, old CRM values, Day Rate),
queue built once into state/backfill-queue.json with a shared cursor. First:
reconcile the 53 current Needs Review (finished drafts stay; migration leftovers
back to Revisit, questions intact). Batches of ≤10 per the P1 runbook; ~66 batches;
cloud routine 2×/day ≈ 33 days plus manual bursts. The 📥 Review flood this
creates is expected and is what pulls Stage C forward.

**A3. Digest (Phase R v1).** Every run, manual or routine, ends with a push:
"P1: 10 enriched, 7 questions waiting" + Review link. Routine-native push; local
runs log the same line.

### Stage B — background runs (parallel with A)

Cloud routines via /schedule, each ending with the digest push:
- **P1-backfill**: 2×/day from backfill-queue; becomes plain P1 intake (1×/day)
  when the queue empties.
- **P2 upkeep**: weekly (details in Phase 2 section below).
- **P3 scout**: weekly, only after backfill ≥ 50% done.
Verify before trusting: NOTION_API_KEY in the cloud env, Playwright runs there,
state/assets commits push to main (daily backup workflow proves cloud→main works).
Known gap: the IG persistent profile lives on Jonathan's Mac; cloud routines skip
IG capture and queue those entries in state/ig-queue.json for local sessions (or
the later scouting-account profile) to drain.

### Stage C — review app (Phase R v2)

Tiny Next.js app: Vercel + Tailwind + Clerk. Mobile-first inbox, one entry per
screen: images, drafted fields, Open Questions as tappable choices, free text for
Notes, writes straight back to Notion. Build trigger: ~2 weeks of digest data OR
review backlog > 100, whichever first. Requires the R2 image sync (Notion file
URLs expire); assets/ is canonical so the sync is mechanical and manifest-driven.
Probably the real seed of "The List"; may absorb Phase 5's shortlist UI.

### Stage D — The List

Browse/search mirroring the 25 properties, portfolio pages from R2, shortlists =
Phase 5 Projects DB surfaced in-app, collaborator accounts via Clerk, share links
per shortlist, and an AI advisor (Claude API with read tools over the DB: "who
should I pull for a type-led packaging job?" answered with work, not just names).
Notion remains the write-master; the app reads Notion + R2. A real database only
if a real limit appears.

## Phase 5 — Project shortlists (deferred, design agreed 2026-06-12)

- New **Projects** database with a relation to Companies ("Shortlist"); reverse
  relation on entries shows "Shortlisted for". Replaces the one-checkbox-per-project
  pattern (For Fuse, For WF — left untouched until this phase, then migrated into
  the first two project pages and retired).
- A future frontend ("The List") would read this same structure; build Notion-native
  first.

## Schema v3 — simplification (Jonathan, 2026-06-12: "simplify, the Fuse way")

- Killed: For Fuse, For WF (→ Phase 5 Projects DB; checkmarks in backup), Works Here
  (Works At is now one-way; org's people = filter by Works At), Word of Mouth
  (reputation → Notes), Rating Notes (rating reasoning → Notes). 30 → 25 properties.
- **No meaningless Empty:** judgment selects always hold a value. Zero-states:
  `Work With?: Unvetted`, `Worked Together: Never`, `Familiarity: Don't know them`,
  `Work Status: Unknown`. Backfilled on all rows; pipelines must set zero-states on
  new entries too. Factual fields (Type, Size, Country, links) may be empty only
  while unresearched. (Supersedes the earlier "blanks stay blank" decision for
  Worked Together.)
- **Story capture (the "how do I know them" memory):** no new field — short verdicts
  in Notes, long stories in the page body. The agent nudges: whenever Worked
  Together becomes Once/Repeatedly, or Familiarity ≥ Met or spoken, or Work With?
  leaves Unvetted, and Notes is empty → ONE Open Question: "How do you know them /
  what was working together like? One line in Notes." Built into P1 (intake asks
  "how do you know them?" when evidence suggests prior contact) and the correction
  scan (fires when Jonathan flips a relationship field). Never nags twice.

## Browser strategy (revised 2026-06-12, after the extension permission gap)

The Claude extension's approved-sites store is per-device and only its own side
panel can grant approvals; connected Claude Code sessions cannot (verified on Dia
and fresh Chrome; see memory). Agent browsing through the extension is therefore
PARKED until an extension update ships an approval flow. Current division:
1. **No browser needed (works today, ~85% of intake):** WebFetch/WebSearch for
   facts, scrape.py for images (Squarespace, WordPress, Figma oEmbed, generic).
2. **Playwright headless (Jonathan approved, Stage A installs it):** JS-rendered
   sites (Framer), passcoded case studies (state/passcodes.json), public Figma
   file screenshots. Fully autonomous, carries no logins.
3. **Instagram (decided 2026-06-12):** persistent Playwright profile, Jonathan's
   own account NOW, migrated to a separate scouting account later (re-run the
   login-once step). Elevated challenge risk accepted; spec's pause-on-challenge
   rule is absolute, never complete a challenge. LinkedIn stays snippets-first,
   no login. Extension re-test weekly remains, but nothing blocks on it.

## Conventions (agreed 2026-06-12)

- **Fields filter, pages read.** Anything worth sorting/filtering lives in a property;
  long-form context lives in the page body. `Notes` property = one-line headline,
  Jonathan-owned.
- **Page body layout:** agent-owned image section at top, then a divider; below the
  divider is Jonathan's space. The agent MAY append a note below the divider when
  Jonathan approves that specific addition first (e.g. via an Open Question or the
  review channel: "want me to add this to the page?"); agent-added body notes are
  signed `— Keeper, YYYY-MM-DD` so authorship stays obvious. Unprompted writes
  remain forbidden.
- **One review inbox:** saved view "📥 Review" = `Entry Status: Needs Review`. Every
  pipeline that needs Jonathan's eyes routes through it via Entry Status + Open
  Questions. Views are created by hand (API can't), checklist provided.

## Open questions for Jonathan

1. Assets storage: commit to git or iCloud/Dropbox sync? (prereq #5)
2. Where should the Candidates DB live (same Notion page as Companies, or elsewhere)?
3. Is the linked DB the only one in scope, or are there sibling DBs (e.g. an old
   contacts table) whose data should be folded in during migration?
