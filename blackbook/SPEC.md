# Blackbook: product and operating spec

**Status: proposed for Jonathan's review.** The fixture frontend is merged. Live integration, writeback, new bot schedules, and paid model trials are not approved by this document.

**Goal:** Turn a real brief into a visual shortlist in under 10 minutes, using only the people and studios Jonathan has verified and rated highly. Make it quick to decide whether proposed work belongs in that collection. Keep the interface quiet and Devin-inspired, with portfolio work taking up most of the screen.

## 1. Product and responsibilities

| Surface | v1 behavior |
|---|---|
| **Explore** | Type a brief, see the filters inferred from it, and get a ranked gallery. A result shows work, attributable project credits, and a short explanation built from indexed evidence. Open details or save to a private shortlist. If no eligible result is strong enough, say so; don't broaden eligibility. |
| **Review** | Separate proposals that are ready from those that still need a check. Show work, evidence, proposed changes, and reviewer findings. Approve, reject, or request changes with a note. New candidate rejection prevents re-surfacing; rejecting an update keeps the last approved profile. |
| **Add for review** | Enter a URL or name, surface duplicates, and create a trackable proposal. The submitter gets a status, not an immediate Explore result. |

**Terrayne** owns this spec, priorities, acceptance tests, and release recommendations. Jonathan approves the spec and changes to scope, budget, and live permissions.

The **frontend and data builders** implement the spec; **QA** independently checks relevance, permissions, mobile and keyboard use, sync failures, and decision retries. **Scout**, **Scraper**, and **Portfolio Reviewer** operate the intake system described below. Only Jonathan decides taste, verification, and ratings. Keep his Notes and protected fields out of agent writes.

## 2. Retrieval: embed once, filter first

**Hard rule:** `status = Verified AND rating IN (4, 5)`. Missing or lower ratings, drafts, Revisit, rejected entries, and archived records never enter the search result set. Rating is Jonathan's judgment, not a similarity number. Relevance is separately calibrated on real briefs; don't make a mediocre match look like a four-star result.

1. **Index on change.** Notion remains the canonical Companies database. Normalize records by Notion page ID and resolve duplicates to a single result. Project eligible profiles and attributed work into Postgres with a full-text index and pgvector. Store an embedding for each eligible profile and, where useful, each sourced project. Key vectors by normalized content hash and embedding version. Re-embed only if indexed content changes or the embedding model is replaced, not on each backup, score change, or search. Update the eligibility filter on every sync even when no embedding is needed.
2. **Retrieve in SQL.** Parse explicit filters (e.g. freelance, city, capability) with known terms or an editable control. Embed the normalized brief once with a pinned small embedding model. Rank keyword hits and exact cosine neighbors in Postgres at the current scale, merge ranks (initially reciprocal-rank fusion), and return the best matching evidence for each eligible entry. Exact names and explicit filters stay deterministic. No search-time generation, full-catalog model prompt, browser run, or Scout job. If embedding is unavailable or the brief contains sensitive details that cannot be removed locally, use keyword search and the same filters.
3. **Show evidence.** Build the match explanation from the matched project, field, and source, not model-generated claims. Portfolio thumbnails come from fresh authorized Notion file reads and private storage if retention is permitted; backup links expire. Missing media gets an explicit placeholder. Freelance does not imply current availability. Keep Jonathan's Notes, relationship history, rates, contact data, and raw backups out of embedding requests. Use private structured fields locally for explicit owner-only filters.

**Measure.** The Nov 21 backup has 45 Verified records, of which 32 are rated 4 or 5; 30 of those have image attachments. The existing [benchmark](shortlist-benchmark.json) labels cases against Verified alone. Joining the expected page IDs to that snapshot leaves a grade 2+ eligible answer in 16 of 20 briefs; that is potential coverage, not measured search quality. Compare keyword-only to hybrid on the same eligibility-filtered cases. Target a useful top-five hit on at least 80% of eligible briefs; count catalog coverage and appropriate “no strong match” separately. Require zero ineligible results, including after a rating downgrade or rejection. Tune relevance on a development subset and confirm on held-out briefs. Aim for p95 under 3 seconds to first results.

## 3. Intake and upkeep: proposed pilot cadence

| Job | When and how often | Output |
|---|---|---|
| **Scout: new entry metadata** | On an approved addition or manual submission ready for enrichment; pick up at most five entries in an active intake batch. Do nothing on an empty queue. | Confirm identity and attach sources, capabilities, and work status. Hand the next stage only the fields and sources it needs. |
| **Scout: maintain top studio map** | Weekly, initially up to five maintained studios per run, oldest checked first. Seed from [the roster](../state/roster), prioritizing studios Jonathan rates 4 or 5. Unrated/lower tiers are references, not scouting targets. | Check public team pages and diff against the last complete snapshot. Record URL, date, additions/departures, and source. Dedupe against the roster, Companies, and rejected identities. Add sourced changes as roster proposals and batch them for Jonathan. Only approved roster candidates become New Notion entries via Keeper. No open-web lead generation or outreach by default. |
| **Scout: check existing entries** | Weekly alongside studio checks. Start with the smaller of five entries or 1% of the existing catalog, rounded up; prioritize oldest or never checked, and rotate. Jonathan can request a specific check. | Verify changes that matter, such as a new role or studio, a dead portfolio, or meaningfully new work. A transient error is not a departure. Unchanged sources stop without model calls; material changes become evidence-backed proposals, never silent overwrites. |
| **Scraper: capture work** | Queue-driven, not a periodic rescrape. Run on new entries after metadata and on a targeted request from Jonathan, a reviewer bounce, or a portfolio change confirmed by Scout and queued for review. | Capture only the affected project/media, with credits and sources; prefer distinct projects and local deterministic checks. Preserve rejected assets and unchanged approved work. |
| **Portfolio Reviewer: quality gate** | After a new or changed submission is assembled. Separate from the doer; at most two targeted rework attempts, then park with a reason. | Check identity, source/credit, distinct projects, capability fit, and protected fields. Return concrete field/asset corrections or submit the revision for human review. Never approve it into Explore. |

Roster implementation: [`roster.py`](../scripts/roster.py) lists maintained studios oldest-scouted-first, records snapshots/tenures, and promotes approved candidates. Use the existing [studio-roster design](../PLAN.md#phase-3--scout-p3-redesigned-around-the-studio-roster-jonathan-2026-06-15) and actual roster implementation as the reference. The older Keeper prose mentions a separate Candidates database; do not add one for this pilot. Don't run the same queue from two schedules. Confirm the existing schedule and its budget before changing it.

Each job must have a durable cursor or idempotency key, a small explicit scope, an independent reviewer where applicable, and a stop on failed authentication or repeated source failures. Use source fingerprints and cached artifacts to skip unchanged work. Log counts, evidence gaps, spend, and what was deferred. The product never invokes these jobs from search. For reviewer learning, record Jonathan's fixes by field, asset, and rubric version; propose changes from recurring misses, test against held-out cases, and have QA and Jonathan approve changes before using them.

## 4. Devin modes, quality, and ACU budget

**What happened.** The fixture builder used frontend design mode. Scout, Scraper, Portfolio Reviewer, and QA inherited the Devin default; no mode was chosen per role. That does not identify a specific underlying model. The older [Keeper policy](../CLAUDE.md#the-agent-split-jonathan-2026-06-15) pins its Claude subagents to Sonnet 4.6. That is separate from the mode of a Devin bot or child session. We have not measured quality or ACUs by mode yet.

| Role | How to spend less | What to test |
|---|---|---|
| **Scout** | Use scripts for roster diffs, duplicate checks, and unchanged pages. | Lite vs Normal on evidence-backed identity, metadata, and studio moves. |
| **Scraper** | Use the capture tools and manifest checks first; reuse approved media. | Lite vs Normal on project selection, attribution, and distinct media. |
| **Portfolio Reviewer** | Run rule checks first and give the independent reviewer the same evidence packet. | Lite vs Normal on wrong identity, misattribution, duplicate projects, and missing evidence. |
| **QA** | Run deterministic tests first; no scheduled sessions. | Use a scoped Lite session for routine triage; reserve Normal for unresolved judgments, including blind grading of the pilot. |

**Paired mode trial, no live writes.** Pin the repo revision, instructions, allowed tools, and 12 labeled packets per operational role. Start with two representative packets per role in each mode, grouped in six scoped child sessions. Use identical inputs, including thumbnails, and grade blind to mode. Log actual session IDs, modes, ACUs, retries, escalations, pass/fail reasons, and latency. Review the measured cost before funding the remaining ten packets per role. Until Jonathan agrees an ACU ceiling, don't dispatch the trial. Run one comparison group at a time, check usage before dispatching the next, and stop if there is not enough budget for that group. No open-ended browsing or automatic retries in the trial.

**Choose a mode per role, not one for every bot.** Adopt Lite only if it costs less after escalations, has zero critical misses, passes at least 11 of 12 cases for that role, and does not miss a required check that Normal got right. If both modes miss a requirement, fix the tool or rubric and keep the role manual. Once deployed, escalate an unclear Lite result to at most one Normal run or a human. Keep the first batch in shadow before promoting any mode choice.

**Budget in Devin ACUs.** Attribute grader, failed, retried and escalated runs as well as successful ones. Read each session's recorded ACUs and count parent/orchestration overhead once. Report each role's ACUs per accepted output, plus end-to-end **ACUs per accepted entry**: total bot and child ACUs for the batch divided by entries that pass the independent gate. Report the count when none pass; for the reviewer also report ACUs per correct verdict so rejecting bad work isn't penalized. Use measured run costs and the proposed intake and maintenance volume to forecast a weekly range, including routine checks that produce no new entries. Propose the weekly ACU cap from that forecast; don't price it in dollars without the account's contracted rate. No recurring spend or mode change is authorized here.

### Direct script API calls, if introduced

Search still uses one small embedding model and no generative calls. Consider Haiku 4.5 vs Sonnet 4.6 only if a specific script gains a direct generative API call; compare identical evidence on that step, not whole Devin sessions. For example, at the [published direct API rates](https://docs.anthropic.com/en/docs/about-claude/pricing), 12 calls per model capped at 8,000 input and 1,000 output tokens each cost at most US$0.63 total for tokens, with no retries or paid tools. That is not a Devin budget. Confirm the provider, data boundary, and token limit before any such calls.

## 5. Progression and stop points

| Stage | Work | Exit gate |
|---|---|---|
| **0. Agree the spec** | Review this document and README. Inventory existing jobs and validate real role inputs. | Jonathan approves direction. No app work resumes before this. |
| **1. Read-only data and relevance** | Keep the fixture UI; connect a small private slice to a read-only Notion projection. Build lexical and vector retrieval and hydrate permitted thumbnails. Reuse [the benchmark](shortlist-benchmark.md), but enforce the new eligibility rule. | Prove fresh media and last-good sync, hit the relevance target, and show what the rated catalog cannot cover. No reviews write to Notion. |
| **2. Shadow review and mode trial** | Review versioned real submissions in a private sandbox without writing to Notion. With an approved ACU cap, run the bounded Devin mode trial separately. Audit the paused shadow-review branch against the spec before taking code from it. | QA proves owner-only access, actionable feedback, no draft leaks, no duplicate decisions, and rollback. Publish quality and ACUs per accepted entry, with a recommendation per role. |
| **3. Owner writeback and bounded jobs** | Separately approve writeback and then pilot the queue. Store the decision and retryable write job together; check for conflicts and read back from Notion before publishing. | Jonathan owns every verification/rating decision, dry-run and rollback work, and jobs stay within the approved cost and scope. Only then consider weekly schedules. |

Do not add public sharing, collaborator invites, bulk rescraping, or replace Notion in v1. Get explicit approval before production writes, recurring ACU spend, or sending real catalog content to a direct API provider.
