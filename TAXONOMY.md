# TAXONOMY.md — Capabilities rulebook (v1, 2026-06-12)

The live tagging rulebook. Read before every tagging decision. Updated only through
the corrections loop (state/corrections.jsonl → distillation → Jonathan approves diff).

## Principles

- Tags describe what an entity CAN DO, never what they are called (no roles, no titles).
- Tags are objective: a tag must be defensible from visible work or stated facts.
- Multiple tags are normal (a person can design and build); don't force one.
- Relationship facts (client, worked-with) are NEVER capabilities — they live in
  Worked Together / Familiarity / etc.
- When unsure between two tags, check the disambiguation pairs below; still unsure →
  pick the more general tag and add an Open Question.

## The tags (19)

| Tag | One-line definition |
|---|---|
| Graphic design | visual design output: posters, editorial, packaging, data visualisation |
| Identity systems | full brand programmes: logo + system + guidelines (a poster series alone is Graphic design) |
| Type design | designs typefaces (foundries and individuals) |
| Web design | designs websites/digital products (look, layout, interaction) |
| Can build websites | writes the code that ships sites (front- or back-end) |
| Creative technology | code-driven interactive work: installations, generative, AR/VR, games |
| 3D & motion | 3D rendering, animation, motion design |
| Photography | shoots photos professionally |
| Illustration | draws/illustrates |
| Film & video production | directs, shoots or produces moving image |
| Sound design | audio: sound design, composition, music for media |
| Creative direction | leads creative output across a team/project; sets the vision |
| Strategy & research | brand strategy, research, consulting, positioning, marketing/PR thinking |
| Copywriting | writes professionally (brand voice, campaigns, editorial) |
| Product design | designs products (digital products or industrial) |
| Spatial & exhibition design | physical space: exhibitions, retail, scenography, architecture |
| Art practice | makes autonomous art (exhibits, sells, commissions as artist) |
| Print production | prints things (vendor capability) |
| Paper & materials | supplies paper/materials/manufacturing (vendor capability) |

## Disambiguation pairs

- **Identity systems vs Graphic design**: full brand programme (logo, system,
  guidelines, rollout) → Identity systems. Individual pieces, however good → Graphic
  design. Both is common for studios.
- **Web design vs Can build websites**: design ≠ build. Portfolio shows shipped code
  (their own dev credits, GitHub, "design & development") → both tags. Agency that
  subcontracts dev → Web design only.
- **Creative technology vs Can build websites**: websites/apps → Can build websites.
  Installations, generative work, unusual tech (AR, sensors, games) → Creative
  technology. WebGL-heavy sites → both is acceptable until a "Can build WebGL"
  split is approved.
- **Art practice vs Illustration/Photography**: commissioned output → the craft tag.
  Autonomous work, exhibitions, gallery representation → Art practice (often both).
- **Strategy & research vs Creative direction**: thinking/positioning → Strategy &
  research. Leading the making → Creative direction.
- **Product design vs Web design**: industrial/physical product or a software product
  as a whole → Product design. Marketing sites, portfolios, editorial sites → Web design.

## Migration notes (where v1 came from)

28 legacy Expertise tags → these 19, approved by Jonathan 2026-06-12:
renames (Developer → Can build websites, Brand design → Identity systems, …),
merges (Consultant + PR/Marketing → Strategy & research; Architecture + Space →
Spatial & exhibition design; Manufacturing → Paper & materials; Video Games →
Creative technology; Data Visualisation → Graphic design), drops (*Client = a
relationship fact; Advertising, Saas = not capabilities).

## Known watch-items for the corrections loop

- "Can build WebGL" as a split from "Can build websites" — propose when enough
  entries distinguishably qualify (spec example; not yet split).
- Graphic design is the biggest tag (157). If Jonathan keeps overriding it into
  subsets (editorial, packaging…), propose a split at the next P4.
- Sound design has 1 entry; kept at Jonathan's request (it is a real skill).
  Revisit only if it stays a singleton for a year.
