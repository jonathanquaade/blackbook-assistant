---
description: Self-driving P1 pipeline — drive every New entry through scout -> scraper -> reviewer to Needs Review, on state, without human check-ins
---

You are the orchestrator for a full P1 pipeline run. Goal: take EVERY entry in the P1
loop all the way to **Needs Review**, ready for Jonathan, and **do not stop or wait for a
human until there is no actionable work left.** Read CLAUDE.md (the contract, the agent
split, the permission/human-gate loop) before acting.

## The one rule that makes this self-driving

**Drive on STATE, never on notifications.** Subagents run async and re-invoke you when
they finish, but those notifications arrive mislabeled, or not at all (a scout's task-id
once carried a scraper's result; a scraper finished with no clear notification). If you
end a turn with a passive "I'll wait," the run stalls until a human pokes it. So:

- The single source of truth for "what to do next" is `python3 scripts/keeper.py work
  pipeline`. It returns JSON buckets computed from durable state (Notion status +
  provenance + manifests + review-feedback), each naming an action.
- On EVERY re-invocation (a completion notification OR the scheduled heartbeat) you
  **ignore the notification text, re-run `work pipeline`, and act on the buckets.**
  The notification is only a "maybe wake now" hint; the buckets are the truth.
- You **never end a turn passively.** Either you have just spawned work AND scheduled a
  heartbeat, or every actionable bucket is empty and you have finished (final report,
  no new wakeup).

## Setup (once, at the start of a run)

1. `git pull --quiet`.
2. `python3 scripts/keeper.py work pipeline` — see the whole board. If `new` > 20, run
   `python3 scripts/backup_db.py` and commit before spawning anything.
3. Pick a `RUN_ID` (e.g. a timestamp) for this run's leases. Cap concurrency at ~10
   agents in flight at once; if a bucket is larger, take the first ~10 this tick and the
   rest next tick.

## The tick (repeat until all actionable buckets are empty)

Run `python3 scripts/keeper.py work pipeline`. The actionable buckets, in the order to
service them (furthest-along first, so Jonathan's inbox keeps filling and nothing
starves):

1. **`at_cap`** (review failed twice) — **adjudicate, do not auto-escalate.** Lease it
   (`keeper.py lease set <id> --phase adjudicate --agent reviewer --run-id RUN_ID`) and
   spawn a SECOND, independent `reviewer` in **adjudicator mode**: give it the page-id +
   the first reviewer's failing `state/review-feedback/<id>.json` and tell it to check
   the first reviewer, not re-derive taste. It either OVERTURNS (entry actually passes →
   it flips to Needs Review and logs the first reviewer's miss to
   `state/reviewer-corrections.jsonl`) or UPHOLDS (genuinely needs Jonathan → it flips to
   Needs Review WITH the unresolved failure written into Open Questions / AI Notes). Both
   outcomes land in Needs Review. When it returns, `keeper.py lease clear <id>`.
2. **`bounced`** (review failed, attempt < 2) — read `review-feedback/<id>.json`; lease
   it (`--phase bounce --agent <to>`); spawn the `to` agent (scraper or scout) with the
   feedback's `summary`/`fix`. When that doer returns, **keep the entry leased**, refresh
   the lease (`--phase review --agent reviewer`), and spawn the `reviewer` to re-gate it.
   Only when the reviewer returns do you `lease clear`. (Keeping the lease across the
   doer->reviewer chain is what stops the stale fail-feedback from re-bucketing the entry
   as `bounced` and looping forever.) The reviewer increments `attempt`; on its verdict
   the next tick routes the entry to `done`, `at_cap`, or another `bounced`.
3. **`needs_review`** (scraper done, gate not yet run) — lease (`--phase review --agent
   reviewer`); spawn one `reviewer`. It runs `checklists/entry-review.md` and either
   flips to Needs Review (pass) or writes a `fail` feedback (-> next tick `bounced`).
   `lease clear` on return.
4. **`needs_scraper`** (scout done, no work captured) — lease (`--phase scraper --agent
   scraper`); spawn one `scraper`. It captures work matched to the tagged Capability +
   the context shots, leaves the entry in Enriching. Logged-in IG/LinkedIn is NOT
   attempted: the scraper queues it to `state/ig-queue.json` / `state/linkedin-queue.json`,
   notes it in AI Notes, and the entry still proceeds. `lease clear` on return.
5. **`new`** (approved candidate) — lease (`--phase scout --agent scout`); spawn one
   `scout` with its page-id + name + one-line known context (it reads CLAUDE.md/TAXONOMY
   itself). It fills all metadata except images, leaves the entry in Enriching. `lease
   clear` on return.
6. **`stalled`** (an agent died mid-flight: Enriching, no progress, lease expired) — treat
   as the phase it failed at and re-spawn (no manifest + no scout metadata -> scout; scout
   metadata but no manifest -> scraper). Lease afresh.

**Spawn in parallel.** Within a tick, issue all the spawns for all the buckets in ONE
message (multiple Agent calls) so different entries advance concurrently and the batch is
never serialized behind the slowest agent. Write each entry's lease BEFORE you spawn its
agent. Entries with a fresh lease show up as `in_flight` and you simply skip them.

**Then, before ending the turn, ALWAYS** call `ScheduleWakeup` with a ~1800s heartbeat
(just over the longest agent runtime) and the same `/process-new` prompt, as a fallback
in case a completion notification is missing or mislabeled. End the turn. When re-invoked,
start the next tick from the top (re-run `work pipeline`).

## Rules

- Honor the contract: never set Verified, never write judgment fields beyond zero-states,
  respect the 0.8 confidence floor (empty beats a guess). Only the reviewer/adjudicator
  flips an entry to Needs Review.
- Do NOT cull non-creatives yourself; if a scout finds someone is ops/strategy not a
  hands-on doer, it records an Open Question so Jonathan decides in Needs Review.
- Keep subagent prompts tight (cost). Subagents stay on Sonnet; do not promote them.
- Cap ~10 concurrent agents. Set `KEEPER_NO_MIRROR=1` for parallel passes (concurrent
  roster writers race the single JSONL); rebuild later with `roster.py sync-all`.
- Commit after each tick that flips entries (`git add -A && git commit`) so progress is
  durable and a cloud tick can resume from a clean tree.
- If the SAME entry hits a hard tool/auth anomaly twice, or a whole tick fails to make
  progress, STOP and report rather than spinning. A `stalled` entry that keeps re-stalling
  after one reclaim is an anomaly, not a retry.

## Done

When `work pipeline` shows `new`, `needs_scraper`, `needs_review`, `bounced`, `at_cap`,
and `stalled` all empty: commit, write the final report, and DO NOT schedule another
wakeup. Final report = total entries processed, how many reached Needs Review, how many
were adjudicated (overturned vs upheld), the IG/LinkedIn queue additions, and the
consolidated list of entries with Open Questions awaiting Jonathan.

## Cloud (Stage B)

This command is the unattended cloud routine too: because it drives on state, leases each
entry, and self-heals stalled work, a scheduled tick can just fire `/process-new` and it
will drain whatever is actionable (or no-op if the queue is empty). `ig.py` / LinkedIn
stay human-gated and queued, never auto-run. Wire the `/schedule` routine only once this
driver is proven in-session.
