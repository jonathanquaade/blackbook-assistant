# Browser session log

Every browser session appends: timestamp, entries processed, pages visited, files downloaded, anomalies. Audit trail per SPEC §4.0.

---
- 2026-06-12T14:23:35 — P1 intake (partial): studio-drama.com/about via WebFetch; florianrunge.com + /information/ via Dia tab; searches for both. 2 entries drafted, 0 downloads, no anomalies. Images pending.
- 2026-06-12T14:34:46 — P1 images: 8 files (sanity/mux CDN) -> Studio DRAMA, 6 specimens -> Florian Runge; uploaded to Notion; both -> Needs Review. No anomalies.
- 2026-06-12T16:09:41 — P1 batch: Eugene (4 imgs), Vova (1 img), Rory (sparse-by-design, 0 imgs, no LinkedIn at threshold). Figma + tably.com blocked by extension site-access. No anomalies.
- 2026-06-12T17:23:40 — P1 rerun: Jonathan-stated facts written via --from-jonathan on 4 Fuse colleagues; Figma thumbnails+embeds added to Georgy & Vova (oEmbed, no browser). Dia automation fully blocked after restart (all domains incl. google.com); browser work deferred to Chrome setup.
- 2026-06-12T17:28:02 — P1: Nadia Lee Cohen enriched from portfolio site + press, 5 captioned campaign images uploaded, Autonomy 5 estimated. IG capture deferred to Chrome. Website correction proposed, not overwritten (set_by jonathan).
- 2026-06-13T11:10:40 — P1 run 2026-06-13: Eugene Serpokrylov (37df84ba), Georgy Gushchin (37df84ba-813a), Nadia Lee Cohen (368f84ba). Branevsky: all 4 case studies via Playwright --passcode sesame, 16 images. Georgy: Figma CDN blocks headless (documented), 3 images, Instagram georgy_uncle from Behance. Nadia: 6 IG images without login (public profile, no persistent profile needed). All three remain Needs Review.
- 2026-06-14T13:57:45 — IG capture (ig.py) built + Jonathan logged in 2026-06-14. Logged-in grid confirmed serving 1080px once, but repeated automated hits to fernandaruiz.work degraded the grid to avatars-only = soft throttling. Stopped per anomaly rule to avoid flagging the account. Hardened grab: accumulate srcs across virtualised-grid scroll, download via browser session (urllib gets 403). Resume with a single gentle run after cooldown.
- 2026-06-14T20:06:55 — Hakan Sezer (24ff84ba-8133): ruiinstudios.com DOWN (net::ERR_SSL_PROTOCOL_ERROR, https cert broken). Sourced Phoebe Philo store instead; queued @ruiinstudios IG for hi-res later. IG still throttled from earlier.
- 2026-06-14T21:11:18 — Neil Jackson (162f84ba-81f1): neil.graphics is PASSCODE-PROTECTED (no code), IG unconfirmed (multiple Neil Jacksons), Cash App work not public. No images captured. Asked Jonathan for the site passcode.
