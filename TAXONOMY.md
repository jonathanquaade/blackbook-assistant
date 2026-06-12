# TAXONOMY.md — Capabilities rulebook (v2, 2026-06-12)

The live tagging rulebook. Read before every tagging decision. Updated only through
the corrections loop (state/corrections.jsonl → distillation → Jonathan approves diff).

## Principles

- Tags describe what an entity CAN DO, never what they are called (no roles, no titles).
- Tags are objective: a tag must be defensible from visible work or stated facts.
- Multiple tags are normal (a person can design and build); don't force one.
- Relationship facts (client, worked-with) are NEVER capabilities — they live in
  Worked Together / Familiarity / etc.
- Tags are kept in alphabetical order in Notion. New tags get inserted in order.
- When unsure between two tags, check the disambiguation pairs below; still unsure →
  pick the more general tag and add an Open Question.

## The tags (26)

| Tag | One-line definition |
|---|---|
| 3D & motion | 3D rendering, animation, motion design |
| Art practice | makes autonomous art (exhibits, sells, commissions as artist) |
| Backend development | builds server-side: APIs, databases, infrastructure |
| Brand strategy | positioning, brand platforms, naming strategy |
| Copywriting | writes professionally (brand voice, campaigns, editorial) |
| Creative direction | leads creative output across a team/project; sets the vision |
| Creative technology | code-driven interactive work: installations, generative, AR/VR, games |
| Digital product design | designs software products: apps, tools, interfaces beyond marketing sites |
| Film & video production | directs, shoots or produces moving image |
| Frontend development (apps) | builds native/mobile apps (iOS, Android, desktop) |
| Frontend development (web) | builds websites: the code that ships in a browser |
| Graphic design | visual design output: posters, editorial, packaging, data visualisation |
| Identity systems | full brand programmes: logo + system + guidelines (a poster series alone is Graphic design) |
| Illustration | draws/illustrates |
| Industrial design | designs physical products: objects, furniture, hardware |
| Insights & research | user/market research, audience insights, testing |
| Paper & materials | supplies paper/materials/manufacturing (vendor capability) |
| Photography | shoots photos professionally |
| Print production | prints things (vendor capability) |
| Producing | produces creative projects: budgets, logistics, crews, making it happen |
| Product design | ⚠ TRANSITIONAL — being re-sorted into Industrial design / Digital product design during verification; do not apply to new entries |
| Social media content | creates content for social platforms (short video, formats, creator work) |
| Sound design | audio: sound design, composition, music for media |
| Spatial & exhibition design | physical space: exhibitions, retail, scenography, architecture |
| Type design | designs typefaces (foundries and individuals) |
| Web design | designs websites/digital products (look, layout, interaction) |

## Disambiguation pairs

- **Identity systems vs Graphic design**: full brand programme (logo, system,
  guidelines, rollout) → Identity systems. Individual pieces, however good → Graphic
  design. Both is common for studios.
- **Web design vs Frontend development (web)**: design ≠ build. Portfolio shows
  shipped code (dev credits, GitHub, "design & development") → both tags. Agency
  that subcontracts dev → Web design only.
- **Frontend development (web) vs (apps) vs Backend**: browser sites → web. Native
  iOS/Android/desktop → apps. APIs/databases/infra → Backend. Full-stack people get
  several tags.
- **Creative technology vs Frontend development (web)**: websites/apps → Frontend.
  Installations, generative work, unusual tech (AR, sensors, games) → Creative
  technology. WebGL-heavy sites → both is acceptable.
- **Industrial design vs Digital product design**: physical object → Industrial.
  Software product → Digital product design. (Industrial design = the standard
  industry term for physical product design; use it confidently in queries.)
- **Digital product design vs Web design**: a product you log into and use → Digital
  product design. Marketing sites, portfolios, editorial sites → Web design.
- **Brand strategy vs Insights & research**: deciding what the brand should be →
  Brand strategy. Finding out what's true (research, testing, audience insight) →
  Insights & research. Strategy consultancies often get both.
- **Brand strategy vs Creative direction**: thinking/positioning → Brand strategy.
  Leading the making → Creative direction.
- **Producing vs Film & video production**: Producing = the organizing capability
  (any medium: shoots, events, campaigns). Film & video production = the craft of
  making moving image. A line producer for brand campaigns → Producing only.
- **Social media content vs Film & video production**: platform-native creator
  output (formats, hooks, channel growth) → Social media content. Crafted films
  that also get posted → Film & video production.
- **Art practice vs Illustration/Photography**: commissioned output → the craft tag.
  Autonomous work, exhibitions, gallery representation → Art practice (often both).

## Bulk defaults applied 2026-06-12 (verify during P2)

These were bulk-mapped with a best-guess default; treat as unverified until the
entry passes verification:
- 114 × old "Can build websites" → **Frontend development (web)** (most are portfolio
  site devs; re-tag to apps/Backend where the work shows it).
- 26 × old "Strategy & research" → **Brand strategy** (re-tag/add Insights & research
  where the work shows it).
- 29 × **Product design** (transitional) → sort into Industrial design / Digital
  product design per entry, then retire the tag.

## Changelog

- **v2 (2026-06-12, Jonathan's corrections):** split Can build websites →
  Frontend (web)/Frontend (apps)/Backend; split Strategy & research → Brand
  strategy / Insights & research; split Product design → Industrial / Digital
  (transitional); added Producing, Social media content; alphabetical order.
  26 tags now — above the 12–20 target; P4 watches usage.
- **v1 (2026-06-12):** migrated 28 legacy Expertise tags → 19, per approved mapping
  (drops: *Client = relationship fact; Advertising, Saas = not capabilities).

## Known watch-items for the corrections loop

- Tag count (26) exceeds the 12–20 target — flag low-usage tags at next P4.
- Graphic design is the biggest tag (157). If Jonathan keeps overriding it into
  subsets (editorial, packaging…), propose a split at the next P4.
- Paper & materials: Jonathan questioned what it is — candidates for rename/merge
  at next P4 if it stays fuzzy.
