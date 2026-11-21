# Blackbook shortlist benchmark (v1)

20 briefs Jonathan would type into Explore, each with the entries a good shortlist should surface and why. Machine-readable copy: [shortlist-benchmark.json](shortlist-benchmark.json) (with Notion page IDs).

Grounded in `backups/latest.csv` (Nov 20 snapshot, 862 rows; 45 Verified). Read-only: no Notion data was changed.

## How to score

- **Grades:** 3 = ideal, should be in the top 5. 2 = good, useful if shown. 1 = acceptable with a caveat, should not lead.
- **Useful result:** any grade 2 or 3 entry in the top 5. One person with duplicate pages counts once.
- **Slice 1 gate:** a useful result for at least 80% of the 16 `pilot` briefs (13 or more).
- **Coverage, reported separately:** the 4 `catalog` briefs need Needs Review entries. On the Verified-only pilot they must return an honest weak-match message.
- **Should not lead:** an entry in that column at rank 1 is a miss.
- Reasons quote Jonathan's Notes for the human grader only; search must not send Notes to a model provider.

## Summary

| ID | Brief | Scope | Top expected |
|---|---|---|---|
| B01 | Find freelance designers for a type-led food packaging project | pilot | Pedro Destefani, Julia Miceli Pitta |
| B02 | Freelance identity designer for a bold, system-driven challenger rebrand with a strong typographic backbone | pilot | Leonhard Laupichler, Daan Rietbergen, Sophia Brinkgerd |
| B03 | Senior product designer for a B2B SaaS design system | pilot | Eugene Serpokrylov, Rory Keohane, Vova Stegantsov |
| B04 | Web designer who can also code an experimental, bespoke portfolio site | pilot | Fernanda Ruiz, Paul Lacour |
| B05 | Luxury fashion website art director in Paris or London | pilot | Elodie Fabbri, Sandra Autukaite |
| B06 | Someone I've worked with repeatedly who can help on a digital project next week | pilot | Fernanda Ruiz |
| B07 | Swiss-style poster designer for a cultural institution | pilot | Claudia Colombo, Daan Rietbergen |
| B08 | Editorial and book designer for an art publisher | pilot | Vitor Carvalho, Julia Miceli Pitta |
| B09 | 3D and CGI motion designer for a tech product launch film | pilot | Vincenzo Marchese Ragona |
| B10 | Director and DoP for an athletic brand film | pilot | Lex Carthur |
| B11 | Music and sound design for a fashion campaign film | pilot | Alex Hislop |
| B12 | Set designer or art director with an edgy art practice for a fashion shoot | pilot | Sofia Alazraki |
| B13 | Photographer for a high-profile fashion campaign | pilot | Nadia Lee Cohen |
| B14 | Type designer for a custom brand typeface with multi-script support | pilot | Florian Runge, Studio DRAMA |
| B15 | Senior ex-COLLINS or Porto Rocha level identity designer | pilot | Megan Bowker, Joseph Lebus |
| B16 | Emerging junior type and identity designer for support work | pilot | Surya Anand |
| B17 | Creative technologist for an interactive installation in London | catalog | Mat Hill, Felix Faire – Music. Code. Design |
| B18 | Frontend development studio for a WebGL-heavy marketing site | catalog | Basement Studio |
| B19 | London printer for a short-run luxury print job on premium stock | catalog | Identity Print, Push Print |
| B20 | Furniture designer for a limited-edition object collaboration | catalog | Mac Collins |

## B01. Find freelance designers for a type-led food packaging project

Scope: **pilot**. Expected interpretation: tags Type design, Identity systems, Graphic design; hard filters {"work_status": ["Freelance"]}; soft terms packaging, food, typography.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Pedro Destefani | Verified | Freelance ex-Mucho Design Director; identity systems plus his own typefaces (Ravena, BPM Display). |
| 3 | Julia Miceli Pitta | Verified | Freelance; AI Notes list packaging alongside identity and editorial systems. |
| 2 | Leonhard Laupichler | Verified | Freelance type designer with published faces; identity-led rather than packaging-proven. |
| 2 | Sophia Brinkgerd | Verified | Freelance; custom typography and logotypes for branding. |
| avoid at #1 | Morgan Light | Verified | Packaging is on-brief (Target up&up) but she is Employed and declined Fuse; caveat, not a lead. |

The plan's own example prompt.

## B02. Freelance identity designer for a bold, system-driven challenger rebrand with a strong typographic backbone

Scope: **pilot**. Expected interpretation: tags Identity systems, Type design; hard filters {"work_status": ["Freelance"]}; soft terms system-driven, bold, rebrand.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Leonhard Laupichler | Verified | Tier 1 in the June shortlist; Supreme and Athens Kallithea FC identity work; Jonathan met him. |
| 3 | Daan Rietbergen | Verified | Studio Dumbar identity systems (Dutch National Police); Work With? Yes after the Fuse call. |
| 3 | Sophia Brinkgerd | Verified | Works as a duo with Laupichler; identity plus custom type. |
| 2 | Pedro Destefani | Verified | Identity systems plus type design, freelance since 2025/26. |
| 2 | Julia Miceli Pitta | Verified | Brand systems; solo-studio founder caveat. |
| avoid at #1 | Julen Saenz | Verified | Jonathan's Notes: only works through his studio HIRUKI now, not a freelancer. |

Mirrors freelance-branding-shortlist-2026-06-15.md.

## B03. Senior product designer for a B2B SaaS design system

Scope: **pilot**. Expected interpretation: tags Digital product design; soft terms design system, B2B, SaaS.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Eugene Serpokrylov | Verified | Jonathan: impressed with his design-system work; Definitely, worked together repeatedly. |
| 3 | Rory Keohane | Verified | Rating 5, Definitely, worked together repeatedly. |
| 3 | Vova Stegantsov | Verified | Rating 5, Definitely, worked together repeatedly. |
| 2 | Georgy Gushchin | Verified | Yes, worked together repeatedly. |
| 1 | Daniella Marynova | Verified | SaaS/fintech product work; In a pinch, employed full-time. |
| avoid at #1 | Eugene Ekuban | Verified | Jonathan's Notes: not much B2B product experience. |

## B04. Web designer who can also code an experimental, bespoke portfolio site

Scope: **pilot**. Expected interpretation: tags Web design, Frontend development (web); soft terms experimental, bespoke, design and build.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Fernanda Ruiz | Verified | Designer and creative developer; Jonathan's 'best of the best', Rating 5, Definitely. |
| 3 | Paul Lacour | Verified | Paris designer-developer at the intersection of code and art direction. Two Verified entries exist: show once. |
| 2 | Laura Piccolo | Verified | Designs and codes sites for cultural institutions and artists; Awwwards HM. |

Also a dedupe check: Paul Lacour has two Verified pages and must appear as one card.

## B05. Luxury fashion website art director in Paris or London

Scope: **pilot**. Expected interpretation: tags Web design; hard filters {"location": ["France", "UK", "United Kingdom"]}; soft terms luxury, fashion, art direction.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Elodie Fabbri | Verified | Kenzo, Chanel, Bottega Veneta, Maison Margiela; Rating 5; highly recommended to Jonathan. |
| 3 | Sandra Autukaite | Verified | Luxury fashion web experience (Moncler at R/GA); worked together repeatedly. |
| 2 | Catherine Uhlrich | Verified | Ex-AKQA/Instrument digital design director; Kenzo, Dior. |
| 1 | Thomas Hervé | Verified | Paris solo studio; fashion/lifestyle clients. |
| 1 | Eugene Ekuban | Verified | Luxury/editorial leaning web designer (Rolls-Royce, OMNIYAT). |

## B06. Someone I've worked with repeatedly who can help on a digital project next week

Scope: **pilot**. Expected interpretation: tags Digital product design, Web design; hard filters {"worked_together": ["Repeatedly"]}; soft terms availability.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Fernanda Ruiz | Verified | Repeatedly, Definitely, freelance. |
| 2 | Sandra Autukaite | Verified | Repeatedly; freelance web designer. |
| 2 | Rory Keohane | Verified | Repeatedly, Definitely; employed, so availability unknown. |
| 2 | Vova Stegantsov | Verified | Repeatedly, Definitely; employed. |
| 2 | Eugene Serpokrylov | Verified | Repeatedly, Definitely; employed. |

Tests the relationship filter. 'Next week' cannot be verified: results must say availability is unknown, never imply it.

## B07. Swiss-style poster designer for a cultural institution

Scope: **pilot**. Expected interpretation: tags Graphic design; soft terms poster, Swiss typography, cultural.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Claudia Colombo | Verified | Swiss Design Award 2022, 100 Beste Plakate; London/Zurich; worked together repeatedly. |
| 3 | Daan Rietbergen | Verified | Amsterdam Sinfonietta poster series at Studio Dumbar; TDC Ascenders. |
| 2 | Salome Frenzel | Verified | Swiss typography meets experimental posters; Jonathan: more editorial than corporate. |

## B08. Editorial and book designer for an art publisher

Scope: **pilot**. Expected interpretation: tags Graphic design; soft terms editorial, book design, publishing.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Vitor Carvalho | Verified | Specialises in editorial and book design, publication systems. |
| 3 | Julia Miceli Pitta | Verified | Clients include Phaidon and Thames & Hudson. |
| 2 | Salome Frenzel | Verified | Editorial and book design; Jonathan notes editorial strength. |
| 1 | Daan Rietbergen | Verified | Editorial/book design is part of his practice. |

## B09. 3D and CGI motion designer for a tech product launch film

Scope: **pilot**. Expected interpretation: tags 3D & motion; soft terms CGI, product launch, film.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Vincenzo Marchese Ragona | Verified | CGI and motion direction for Apple AirPods, Nike, Puma; ex-Porto Rocha. |
| 2 | Alexander Houben | Verified | Motion systems, ex-filmmaker; graphic-motion rather than CGI product. |

## B10. Director and DoP for an athletic brand film

Scope: **pilot**. Expected interpretation: tags Film & video production; soft terms sport, athlete, brand film.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Lex Carthur | Verified | Athlete-driven brand films for Nike, Adidas, On, Rapha; Jonathan: 'a very cool rapha campaign'. |

## B11. Music and sound design for a fashion campaign film

Scope: **pilot**. Expected interpretation: tags Sound design; soft terms fashion, campaign, music.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Alex Hislop | Verified | Music and sound for Miu Miu, Prada, Nike, Alexander McQueen. |

## B12. Set designer or art director with an edgy art practice for a fashion shoot

Scope: **pilot**. Expected interpretation: tags Art practice, Spatial & exhibition design; soft terms set design, fashion, edgy.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Sofia Alazraki | Verified | Art director and set designer, fashion-led; Rating 5; Jonathan: an edgier Isabel & Helen. |
| 1 | Nadia Lee Cohen | Verified | Photographer/artist with strong art direction; adjacent, not a set designer. |

## B13. Photographer for a high-profile fashion campaign

Scope: **pilot**. Expected interpretation: tags Photography; soft terms fashion, campaign, celebrity.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Nadia Lee Cohen | Verified | Balenciaga, Gucci, Miu Miu campaigns; Rating 5. Jonathan: a celebrity photographer. |
| 1 | Lex Carthur | Verified | Came up through photography; now mainly moving image, sport. |

## B14. Type designer for a custom brand typeface with multi-script support

Scope: **pilot**. Expected interpretation: tags Type design; soft terms custom typeface, multi-script, brand font.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Florian Runge | Verified | Multi-script (Armenian, Cyrillic, Devanagari, Georgian, Greek, Hebrew, Latin); Samsung One with Brody. |
| 3 | Studio DRAMA | Verified | Custom type for Mozilla/Firefox, Heinz, Vogue; D&AD Wood Pencils. |
| 1 | Pedro Destefani | Verified | Draws his own display faces; Latin, not multi-script. |
| 1 | Leonhard Laupichler | Verified | Published typefaces; not multi-script. |

## B15. Senior ex-COLLINS or Porto Rocha level identity designer

Scope: **pilot**. Expected interpretation: tags Identity systems; soft terms COLLINS, Porto Rocha, senior.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Megan Bowker | Verified | Former COLLINS Design Director; led Girl Scouts rebrand. |
| 3 | Joseph Lebus | Verified | Design Principal, Porto Rocha London; Rating 5. |
| 2 | Morgan Light | Verified | COLLINS Design Director (Target up&up); not available per Notes. |
| 2 | Yedo Han | Verified | Senior Designer, Porto Rocha NY; Rating 5. |
| 2 | Jessica Bong-Woon | Verified | CD/ACD at Ragged Edge. |

## B16. Emerging junior type and identity designer for support work

Scope: **pilot**. Expected interpretation: tags Type design, Identity systems, Graphic design; soft terms junior, emerging.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Surya Anand | Verified | Associate Designer at Porto Rocha, b. 2003; display typefaces and identity. |
| 2 | Leonard Behre | Verified | MA typography student; experimental type on Instagram. |
| 2 | Salome Frenzel | Verified | Early-career freelance (graduated 2021); posters and identity. |

## B17. Creative technologist for an interactive installation in London

Scope: **catalog**. Expected interpretation: tags Creative technology; hard filters {"location": ["UK", "United Kingdom"]}; soft terms installation, interactive, generative.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Mat Hill | Needs Review | Generative tools and installations for Pentagram (Barbican Mechasobi, NHM); Rating 5, worked together repeatedly. |
| 3 | Felix Faire – Music. Code. Design | Needs Review | Computational designer; worked on Intrinsic at Pentagram with Jonathan. |
| 2 | Adam Heslop (Pixels in Progress) | Needs Review | 3D and creative tech; worked together once (Cohere tool). |

No Verified entry carries Creative technology: the pilot must answer 'no strong match' and offer to include Needs Review entries or relax a constraint.

## B18. Frontend development studio for a WebGL-heavy marketing site

Scope: **catalog**. Expected interpretation: tags Frontend development (web); soft terms WebGL, 3D web, studio.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Basement Studio | Needs Review | Next.js/3D sites for Vercel, Linear, Cursor; Jonathan: Definitely, 'YES hahaha'. |
| 2 | DXR Zone | Needs Review | Work With? Yes: talented, organised, honest. |
| 2 | Victor Costa | Needs Review | Rating 5, Work With? Yes; individual rather than studio. |
| 2 | Fictive Kin | Needs Review | Worked together repeatedly on Hebbia.ai. |
| avoid at #1 | Midnight | Needs Review | Jonathan: only in a pinch. |

## B19. London printer for a short-run luxury print job on premium stock

Scope: **catalog**. Expected interpretation: tags Print production; hard filters {"location": ["UK", "United Kingdom"]}; soft terms short-run, luxury, litho.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Identity Print | Needs Review | Short-run luxury print on premium stocks. Two pages exist: show once. |
| 3 | Push Print | Needs Review | High-end litho print and finishing, London. |
| 2 | Dot Studio | Needs Review | Small independent London print production studio. |
| 1 | GF Smith | Needs Review | Premium paper merchant: supplier for the stock, not the printer. |

Vendor brief: Paper & materials entries are suppliers and should rank below printers (TAXONOMY.md).

## B20. Furniture designer for a limited-edition object collaboration

Scope: **catalog**. Expected interpretation: tags Industrial design; soft terms furniture, object, limited edition.

| Grade | Entry | Status | Why |
|---|---|---|---|
| 3 | Mac Collins | Needs Review | Furniture designer and artist (Iklwa chair); Rating 5, worked together repeatedly. |
| 1 | Special Projects | Needs Review | Design and innovation studio; product/object adjacent. |
