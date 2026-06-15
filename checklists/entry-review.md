# Entry review checklist (the reviewer's gate)

The reviewer is an INDEPENDENT agent. It did not capture the work, so it grades it
without the doer's bias. This file is the checklist it runs against every entry
before the entry may reach Jonathan. The reviewer MAINTAINS this file: when
Jonathan's v1 feedback reveals a miss, the reviewer adds/sharpens a check here and
logs the correction to `state/reviewer-corrections.jsonl`.

The reviewer checks COMPLETENESS and CORRECTNESS, never taste. Work With?, Rating,
Worked Together and Familiarity are Jonathan's alone; the reviewer never asserts them.

## How the reviewer runs (v1 → v2)

- **v1 (calibration):** evaluate every entry, write a report (each item PASS/FAIL +
  one-line evidence), flip the entry to Needs Review, and surface the report to
  Jonathan alongside the entry. His corrections tune this checklist. Goal: learn his
  bar. The report is written to `state/review-feedback/<page-id>.json`.
- **v2 (production):** the reviewer GATES. FAIL on any item → bounce to the
  scraper/scout with specific feedback (`state/review-feedback/<page-id>.json`), up
  to a retry cap of 2; if it still fails, escalate to Jonathan with the reason. PASS
  → flip to Needs Review. The full report is surfaced to Jonathan for a ~5% random
  sample only (a spot-check on the reviewer itself, "the chef tastes a few plates").

A FAIL is specific and actionable. Not "images weak" but "3 of 5 images are the same
Bose project from different angles; need 3+ distinct projects" — the scraper has to
know exactly what to fix.

## The checks

### A. Work / images (the Zuzanna failures live here)
- [ ] **Project diversity.** Images span at least 3 DISTINCT projects, not multiple
      angles/crops of one. FAIL if captions repeat the same project (e.g. three
      "Bose …" shots) or if image hashes/look are near-identical.
- [ ] **Depth over breadth.** Goes inside projects (spreads, screens, interiors),
      not only hero/cover shots.
- [ ] **On-capability.** The captured work matches the tagged Capabilities. A Sound
      designer's entry shows their sound work (embedded), not brand side-projects; a
      Photographer's shows photos. Off-capability capture = FAIL.
- [ ] **Context shots present AND correct.** A screenshot of the real WEBSITE
      homepage AND a screenshot of the real INSTAGRAM PROFILE page. Open each and
      confirm it is what its caption claims: an image captioned "Instagram profile"
      must actually be instagram.com, NOT another website screenshot. Mislabeled
      context shot = FAIL.
- [ ] **No uncaptioned images.** Every image names its project + source link. Prefer
      fewer named images over more anonymous ones.
- [ ] **Embeds for video/audio.** If a project page had a YouTube/Vimeo/SoundCloud
      etc., it is embedded (with a thumbnail preview image + linked caption), not
      screenshotted or skipped. Video/audio/writing creatives still have images too
      (never embeds-only).
- [ ] **Absence is explained.** If a source genuinely has no usable work (dead site,
      gated, IG-only + throttled), AI Notes says so and the IG queue is used — the
      entry is not silently thin.

### B. Scout completeness (the scraper inherits a finished metadata entry)
- [ ] **Type classified** (Person/Studio/Agency/Foundry/Publication).
- [ ] **All findable links present:** Website (canonical root), Instagram (full URL,
      verified right person), LinkedIn, public Email. A missing link is usually a
      skipped search, not an absence — FAIL if an obvious search would have found it.
- [ ] **Capabilities tagged** per TAXONOMY.md (objective, what they CAN DO).
- [ ] **Country / Size / Work Status** set, with Work Status resolved by the
      objective multi-source rule (not a vibe), and the sources named in AI Notes.
- [ ] **Autonomy** estimated (set_by agent) with reasoning, grounded in real work
      history.

### C. Judgment & honesty
- [ ] **No judgment field contradicts evidence.** Zero-states are valid only where
      evidence does not contradict them (e.g. not "Worked Together: Never" when
      Jonathan's note says "working with him atm" — that should be empty + a question).
- [ ] **Clip note fully acted on.** Every instruction in the raw Name/clip text is
      done or asked about; stated facts written via `--from-jonathan`.
- [ ] **AI Notes hedged.** Unverified inferences are hedged; only verifiable facts
      (clients, awards, published work) are asserted. Includes a seniority + experience
      read paired with the Autonomy estimate.

### D. Machinery
- [ ] **Source filled** (clip note verbatim, or "Web clipper, <created date>").
- [ ] **Provenance written** for every touched field; nothing below 0.8 confidence
      was written as fact.
- [ ] **No em-dashes** anywhere written for Jonathan (AI Notes, Open Questions, captions).
- [ ] **Open Questions** are terse, conditional (never ask for a field that already
      has a non-zero value), and the story nudge applied where due.
- [ ] **Status correct:** reaches Needs Review only after this gate passes; a Revisit
      pass flipped back to Needs Review.

## Feedback channel format (`state/review-feedback/<page-id>.json`)

```json
{
  "page_id": "...",
  "reviewer_version": "v1",
  "reviewed_at": "2026-06-15T14:00:00",
  "verdict": "pass | fail",
  "attempt": 1,
  "checks": [
    {"id": "A.project-diversity", "result": "fail",
     "evidence": "3 of 5 images are Bose, different angles",
     "fix": "capture 3+ distinct projects from rogatty.com archive"},
    {"id": "A.context-shots", "result": "fail",
     "evidence": "site-02 captioned 'Instagram profile' is a website screenshot",
     "fix": "capture a real instagram.com/zrogatty profile screenshot"}
  ],
  "to": "scraper | scout"
}
```
