---
description: Run the full enrichment pipeline (scout -> scraper -> reviewer) on every New entry until each is in Needs Review
---

You are the orchestrator for a full P1 pipeline run. Goal: take EVERY entry currently
`Entry Status = New` all the way through scout -> scraper -> reviewer so each ends in
**Needs Review**, ready for Jonathan. Do not stop until the New queue is empty (or you
hit a blocker you must report). Read CLAUDE.md (the contract, the agent split, the
permission/human-gate loop) before acting.

## Setup (once)
1. `git pull --quiet`.
2. `python3 scripts/keeper.py work new` — get the full list of New page-ids + names.
   Count them. If > 20, run `python3 scripts/backup_db.py` first and commit.
3. Process in **batches of ~10**. Within a batch, spawn agents IN PARALLEL (one
   message, multiple Agent calls) so the batch is not serialized.

## Per batch (repeat until the New queue is empty)
1. **Scout pass** — spawn one `scout` subagent per entry in the batch, in parallel
   (they default to Sonnet). Give each only its page-id + name + the one-line known
   context; the agent reads CLAUDE.md/TAXONOMY itself. Each scout fills all metadata
   except images and leaves the entry in Enriching. Wait for all to finish.
2. **Scraper pass** — for each entry the scout completed, spawn one `scraper`
   subagent in parallel. Each captures work matched to the tagged Capability + the two
   context shots, leaves the entry in Enriching. **Logged-in IG/LinkedIn is NOT
   attempted** — if an entry's best work needs it, the scraper queues it to
   `state/ig-queue.json` / `state/linkedin-queue.json`, notes it in AI Notes, and the
   entry still proceeds. Wait for all to finish.
3. **Reviewer pass** — spawn one `reviewer` subagent per entry in parallel. The
   reviewer runs `checklists/entry-review.md`; it bounces failures back (retry cap 2,
   feedback in `state/review-feedback/<id>.json`) and flips the rest to **Needs
   Review**. Honor the bounce loop: re-run the scraper/scout on a bounced entry, then
   re-review, up to the cap. Only the reviewer flips to Needs Review.
4. **Report + commit** the batch: list each entry, its status, key Open Questions,
   and anything queued for logged-in capture. `git add -A && git commit`. Then move to
   the next batch.

## Rules
- Honor the contract: never set Verified, never write judgment fields beyond
  zero-states, respect the 0.8 confidence floor (empty beats a guess).
- "Complete every entry" means do NOT cull non-creatives yourself; if a scout finds
  someone is ops/strategy not a hands-on doer, it records an Open Question so Jonathan
  decides in Needs Review.
- Keep subagent prompts tight (cost). Do not promote subagents off Sonnet.
- If a whole batch hits an anomaly (auth, repeated tool failure), STOP and report
  rather than pushing through.

## Done
When the New queue is empty: final report = total entries processed, how many reached
Needs Review, how many bounced/blocked, the IG/LinkedIn queue additions, and the
consolidated list of entries with Open Questions awaiting Jonathan.
