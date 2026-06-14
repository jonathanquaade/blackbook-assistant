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
- **Vimeo/YouTube embeds show NO poster preview in Notion** (Jonathan, 2026-06-13):
  a wall of embeds looks blank. Fix: also download each video's thumbnail (oEmbed
  `thumbnail_url`) as a captioned preview image; gallery of thumbnails on top, then
  the playable embeds. (Lex Carthur: 8 Vimeo thumbnails + 8 embeds.)
- **Always fill Source on backfill** (Jonathan, 2026-06-13): it is "Web clipper,
  <page created date>" (API created_time) when there's no clip-note provenance.
  Was being left empty. Now a self-review gate item. (Retrofitted Alex Hislop.)
- **"IG-only" entries often aren't** — the Website field held the IG URL, but a web
  search found his real portfolio (lexcarthur.com) + Vimeo. Always search for a real
  site/reel before assuming IG is all they have; fix Website (canonical site) vs
  Instagram (the IG URL) when the clipper conflated them. (Lex Carthur = Alex
  McArthur; film directors keep reels on Vimeo.)
- **scrape.py --render: never use networkidle** (solved-in-tool): media-heavy
  portfolios (3D, autoplay video) keep the network busy forever and networkidle
  times out. Switched to domcontentloaded + fixed settle. (vmragona.com.)
- **3D/motion people: work is video, but often on their OWN site/Vimeo** — the
  IG-login trigger did NOT fire for Vincenzo because his portfolio + project films
  live on vmragona.com (Vimeo embeds) and download fine. The logged-in IG session
  is only needed for creatives whose work lives ONLY on Instagram (reels/carousel).
  Pattern for 3D: embed project Vimeo films + use Vimeo thumbnails as preview
  images + grab any render stills. (Vincenzo: 8 images + 5 embeds.)
- **Work Status via employment trajectory** (objective rule in action): a web
  search gave Vincenzo's full history (Monotype -> CC Studio -> Porto Rocha ->
  co-founder ffforum 2025-present), so Work Status = Studio, Works At Link =
  ffforum.site. Search the trajectory, don't guess from the portfolio alone.
### From the rest of the first batch (Daniella, Fernanda, Sofia, Eugene E., Megan)

- **scrape.py --render now reads currentSrc, not src** (solved-in-tool): lazy-loaded
  galleries keep a placeholder in `src` and the real full-res URL in `currentSrc`;
  reading src missed every image (salazraki.com: 78 "tiny" skips → 8 real images
  after the fix).
- **Creative developers: portfolio = live websites**, not images. Capture as
  screenshots of the live sites they built + bookmarks to them. (Fernanda Ruiz:
  AMI Paris, Stink Films, Future Corp, Monumento — screenshots + bookmarks.)
- **Jonathan's call notes in the body = long-form, KEEP it** (do NOT move to Notes
  or body-reset). Notes is the one-line headline; detailed call notes belong in the
  body per "fields filter, pages read". Extract judgment from them: "Should we work
  with them? Yes" → Work With?: Yes; a detailed conversation → Familiarity: Met or
  spoken (both --from-jonathan). (Eugene Ekuban.)
- **Half-filled review template in body** (Fernanda): preserve it, append the Work
  section without body-reset; let Jonathan clean it in review.
- **Fix Familiarity that contradicts Worked Together** (Fernanda: Repeatedly + a
  glowing note but Familiarity said Don't know them → set Know them well).
- **Migration Country can be wrong** — verify it. (Sofia Alazraki was tagged UK;
  she is Madrid-based → Spain.)
- **Employer history ("Former X") → trace the CURRENT role via LinkedIn.** Megan
  Bowker "Former Collins" → now Soon Foundation for the Arts (matched her site's
  "On Soon"); Vincenzo → co-founder ffforum. Set Work Status from the current role,
  put the history in AI Notes.
- **When the personal site doesn't show the real work, pull Instagram** (the rule in
  action): Megan's site is conceptual/editorial, so her design work came from her IG
  grid.

### Round 2 (Jonathan's review of batch 1 → 5 revisits)

- **Context shots are now standard** (`scrape.py shot`): website homepage + IG
  profile screenshot in every body as memory anchors.
- **Self-hosted mp4 videos upload to Notion** (`keeper.py` type:video, <=20MB):
  download the project film, upload as a video block. (Sofia: 3 NOTHING films.)
- **Going DEEP into project pages yields real work** (vs hero shots): Eugene's
  OMNIYAT/Spotify Wrapped screens came from the project URLs, not the homepage.
- **When their IG/site is off-discipline, go to the past employer's case study.**
  Megan's IG is personal photography; her identity work (Girl Scouts) lives on the
  COLLINS site — extracted from wearecollins.com/case-studies/girl-scouts.
- **Image→project link bug** (Vincenzo): scraped stills got wrong captions/links
  and a project was duplicated as two images. Lesson: Vimeo/oEmbed thumbnails are
  reliably mapped (thumbnail of vimeo X IS project X); scraped page stills are not —
  prefer mapped thumbnails, verify caption↔content.
- **Prefer screenshot+link-caption over bare bookmark** for live sites (Jonathan
  can't see a bookmark without clicking). Bookmarks only as an extra, not the work.
- **Two scrape.py bugs fixed**: dedup loop crashed on bookmark/embed entries (no
  `file` key) → skip them; numbering used file COUNT not max index → `.png` shots
  collided with `.jpg` scrapes → use max index, extension-agnostic.
- **Seniority + Autonomy on every entry** (Jonathan): record a seniority read in AI
  Notes and set the Autonomy estimate, grounded in work history.
### Batch 4 review fixes (Jonathan 2026-06-15) — "a missing link is a skipped search"

- **Always hunt for a personal WEBSITE**, don't settle for IG/Behance-only. Surya
  Anand had suryaanand.com (avant-garde type, Abbie Leach Atelier, far better than
  his lone Behance Semplice project) — missed it entirely first pass. Search
  "<name> portfolio", try <name>.com/.design.
- **Always find their real INSTAGRAM** (try handle variants; the reliable source is
  the external-links list on their own Behance/site/read.cv). Morgan Light is
  @morgan.light (found via her Behance) — I'd said "no IG found", and @morganlight
  is a DIFFERENT person (Morgan Lightcatcher). Wrong-person IGs happened twice
  (Neil's @neilsgraphics too) -> ALWAYS verify bio+grid match; if unsure, ASK.
- Both fixes now in CLAUDE.md step 4.

### Batch 4 (Morgan, Kate, Surya, Claudia, Neil)

- **Agency-first wins**: Morgan Light's up&up (Target) flagship pulled hi-res from
  the Collins case study + her own portfolio. The method works cleanly when the
  agency has public case studies.
- **VERIFY the IG handle is the RIGHT person** before using it. Neil Jackson (3D):
  @neilsgraphics turned out to be a different logo-for-hire designer (bio/work
  mismatch). Check the bio + grid match the person; don't attach by name alone.
- **Work that just isn't publicly capturable** (document + ask/queue, still Needs
  Review): gated "portfolio on request" (Kate Boudreau), passcode-locked site with
  no code (Neil Jackson -> asked for passcode), JS/WebGL sites with no extractable
  media (Neil, Porto Rocha). Build the entry from CV/research, capture a context
  shot if possible, queue IG, and document the blocker in AI Notes.
- **CDN sizing**: ?w=2000 on some Sanity images returned ~10MB; use ?w=1500&q=80
  for a sane ~3-5MB.
- IG queue now has 4 (Hakan, Leonard, Kate, Surya) for when the session is rested.

### PRIMARY work-discovery method (Jonathan 2026-06-14)

The best way to find someone's work: **find the projects they've done, identify the
agencies/brands they did them at, and take the images/video from THOSE sites** (agency
case studies, live brand sites). A designer's own site is often dead/placeholder/
stale; their real work lives at their employers and clients. Order: projects+employers
(interviews, CV/read.cv, search) -> agency case studies + brand sites (high-res from
CDN) -> own site/IG as supplement. Now the headline rule in CLAUDE.md step 6.

### Batch 3 (Alberto, Hakan, Leonard, Christine, david) + IG queue

- **Dead/placeholder personal sites are common, esp. for senior people.** david
  anastácio's site is a 2021 placeholder; read.cv was offline; Ruiin (Hakan) had a
  broken SSL cert. Recover their work from: live brand sites they built (Sublime,
  Moog, Phoebe Philo store), design-feature blogs (ccccache featured his REKKI
  brand), and press. Their TRAJECTORY comes from web search even when their site
  is dead.
- **Wix-hosted videos are downloadable**: video.wixstatic.com/video/<id>/<res>/mp4/
  file.mp4 (Christine's films; map to projects via nearest heading). Small enough to
  upload to Notion.
- **IG queue works**: when IG-only + throttled, finish the rest, append to
  state/ig-queue.json, still Needs Review. (Leonard Behre IG-only; Hakan's studio
  IG.) Drain the queue later with ig.py once the session is rested.
- **A single IG profile context shot works even under throttle** (one nav, cookie
  dismissed) — gives a memory-anchor grid view even when the full grab is queued.
- **scrape.py shot --full** for live brand sites (Sublime/Moog full-page) — good
  single-image capture of a site someone built.

### Round 4 (Megan multi-project + cookie fix v2)

- **Interviews name an agency designer's projects** — the key technique. When a
  designer's own site doesn't show their work (common for agency designers), their
  INTERVIEWS (The Brand Identity, It's Nice That, Creative Boom, etc.) often name the
  specific projects they worked on. Search "<name> interview", read for project
  names, then pull those from the agency's case studies at full res. (Megan's own
  Brand Identity interview named Equinox Hotels + More Than Magic, beyond Girl
  Scouts — turning a one-project entry into three.)
- **Spread across projects, not depth on one.** 10 images of one project is a weak
  portfolio; aim for several projects with a few strong hi-res images each.
- **Cookie/consent shot fix v2**: explicit known button names (IG: "Allow all
  cookies" / "Decline optional cookies"), then Escape the login modal, then WAIT
  ~2.5s for the banner to animate out before the screenshot. The text-regex loop
  alone was flaky.

### Round 3 (Jonathan's 2nd review)

- **shot cookie banner fixed**: dismiss consent ("Decline optional cookies" / "Allow
  all cookies" / "Accept") + Escape login modal BEFORE the screenshot. Every IG shot
  previously captured the cookie banner.
- **Logged-out Instagram is HARD-CAPPED at 640px** (often less for grid thumbnails
  ~293px). This is the pixelation Jonathan flagged on Fernanda. 1080px+ images AND
  reel/carousel video REQUIRE the logged-in persistent profile. THIS is the trigger
  to build it (he logs in once). Until then IG is low-res and stills-only.
- **Agency CDNs downscale in-browser; fetch the original.** Collins = Sanity CDN
  (?w=2000), Squarespace = ?format=2500w. The displayed image is pixelated; the
  origin is sharp. (Megan Girl Scouts, Eugene projects.)
- **Go deep across MULTIPLE projects + high-res** (Eugene round 2: 3 hi-res each
  from Spotify Wrapped, OMNIYAT, Mission 44, Nataal, not laptop mockups).
- **Provenance migration mislabel fixed**: Phase 0 stamped factual fields
  (Name/Website/Instagram/Country/Size) as `jonathan`, falsely locking them.
  Reclassified to `migration` (restructurable). Notes + Capabilities kept as
  jonathan. Future automation should never blanket-stamp `jonathan` on import.
