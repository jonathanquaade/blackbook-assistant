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
- **"Recommended by a friend" is NARROW** (correction 2026-06-13, Jonathan): it
  needs X to be his actual friend AND an active vouch. "Found through / discovered
  via X" is just a discovery path → stays "Don't know them". CLAUDE.md mapping +
  corrections.jsonl updated. (Alex Hislop: he doesn't know Colin personally.)
- **LinkedIn must be actively searched every entry** — I skipped it for Alex and he
  had one. Now a firm P1 step (web search, snippet, no login). (Alex Hislop.)
- **Work Status needs multi-source objective resolution** (new CLAUDE.md section):
  check self-site + IG + LinkedIn; 2 agreeing beat 1; self-maintained site/IG beat
  a stale LinkedIn; unresolvable → Unknown + ask. Don't guess from one source.
- **Non-image work is now a real feature** (keeper.py): manifest entries can be
  `{type:"embed",url,caption}` (audio/video) or `{type:"bookmark",url,caption}`
  (writing), rendered into the Work section by `upload`. For sound/video/writing/
  strategy people the embed/bookmark IS the portfolio; still grab some images.
  (Alex Hislop: SoundCloud + NTS show embedded.) Reusable for videographers
  (Vimeo/YT), writers (article bookmarks), strategists (case-study bookmarks).
- **THOROUGHNESS FAILURE (Jonathan, 2026-06-13, Alex Hislop round 2):** I captured
  his Brand Consultancy section and missed his Music Production section entirely —
  which IS his tagged capability (Sound design) and is full of embeddable YouTube
  videos (e.g. /commercial-music-production/miu-miu, rapha, prada, nike...). Two
  rules now in CLAUDE.md: (1) map the WHOLE site nav, every discipline section,
  before capturing; (2) the captured work must MATCH the tagged Capability — for a
  sound designer that means embedding the actual music/video, not brand side-work.
  Embedding YouTube/Vimeo from project pages is trivial (type:embed) and is the
  right output for these creatives. General principle: think about the creative
  TYPE and where their real work lives, don't just scrape whatever the homepage
  shows.
  Note: project videos may be YouTube OR Vimeo (Alex used both) — check for
  both iframe hosts and convert to clean watch?v=/vimeo.com/<id> URLs for embeds.
- **Provenance migration mislabel fixed**: Phase 0 stamped factual fields
  (Name/Website/Instagram/Country/Size) as `jonathan`, falsely locking them.
  Reclassified to `migration` (restructurable). Notes + Capabilities kept as
  jonathan. Future automation should never blanket-stamp `jonathan` on import.
