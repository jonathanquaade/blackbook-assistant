# Backfill learnings — the Stage B automation spec

Running log of edge cases, platform quirks and recurring judgment calls hit during
the manual backfill. Purpose: this is what a future cloud routine (Stage B) must
handle. Code fixes go into the scripts + their docstrings (tools-over-inline-code
loop); THIS file captures what is NOT a code fix — judgment patterns, ambiguous
cases, hard limits, anything that needs a human-shaped rule.

Format: one dated entry per learning. Note the entry it came from and whether it is
(a) solved-in-tool, (b) a judgment rule now in CLAUDE.md, or (c) an open gap.

---

## 2026-06-13 — session that started the backfill

- **Figma: REST API, not browser.** Headless Playwright gets CloudFront 403 on
  figma.com and embed.figma.com. Solution (solved-in-tool): FIGMA_API_KEY in .env,
  traverse sections → FRAME nodes (any depth, not a fixed level) → export via
  /images at scale=2. Section export = unintelligible giant canvas; always go to
  frames. (Georgy, Vova.)
- **Instagram public grid works headless, no login.** `scrape.py --render` on a
  public profile returns the top-of-grid still images (~12-18). (Nadia.)
  - **Open gap**: video, reels, and media inside carousel posts do NOT load without
    clicking in, and likely need the logged-in persistent profile. Critical for
    3D/motion people whose work IS video on IG. Trigger to build the logged-in
    session: first such entry in the backfill.
- **Passcoded case studies**: `scrape.py --render --passcode CODE`. One site code
  often unlocks ALL case studies on that site (branevsky.com: sesame opened all 4).
  Save per-study keys in state/passcodes.json. (Eugene.)
- **Judgment rule (now in CLAUDE.md)**: "found through / recommended by / friend of
  X" → Familiarity: Recommended by a friend (new 4th option), NOT Worked Together.
- **Judgment rule (now in CLAUDE.md)**: Jonathan's own commentary in the page body
  → move to Notes (set-notes --relocated-from-body) + extract stated judgment; site
  copy → clipped.md + AI Notes. A blanket script can't tell them apart (120-entry
  scan: bodies are overwhelmingly site copy); needs a per-entry human read.

### From the first backfill batch

- **Name is provenance-locked to `jonathan` on migrated entries** (Phase 0 set
  everything to jonathan), which BLOCKS the runbook's "clean Name to just the name"
  step via the agent path. Workaround: do the name-clean through
  `set --from-jonathan` (it is legitimately his name; the suffix like "| Sound
  Design" is clipper context already captured in Capabilities; archive_raw fires
  automatically). Affects most clipper entries with "Name | descriptor" titles.
  Open question for automation: either reclassify clipper-era Name provenance to
  `clipper`, or let a routine strip known suffixes via the from-jonathan path.
  (Alex Hislop.)
- **Sound/music people**: website is an unlabeled visual moodboard (live events,
  release artwork), no project names anywhere (no alt text, no headings), and the
  real work is audio. Rule applied: attribute images to the studio, not invented
  project names; say so in AI Notes. Future: their best "work" may be audio/links,
  not images. (Alex Hislop → GETME!.)
- **The new "Recommended by a friend" Familiarity option works** end-to-end from a
  "Found through X" note via `set --from-jonathan`. (Alex Hislop, "Found through
  Colin Doerffler".)
