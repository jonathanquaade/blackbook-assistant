# Phase 0 — Migration decisions for approval

Based on the live database (710 rows, backed up 2026-06-12). Nothing below is applied
until you approve each section. Edit this file directly or answer in chat.

---

## A. Expertise → Capabilities mapping

28 current tags → 18 proposed (target was 12–20). Counts shown are current usage.

| Current tag | n | → Proposed Capability | Note |
|---|---|---|---|
| Graphic design | 155 | Graphic design | core, keep |
| Developer | 114 | Can build websites | enrichment later splits out "Can build WebGL" where evident |
| Website design | 71 | Web design | design ≠ build; people who do both get both tags |
| Type design | 68 | Type design | keep |
| 3D / Animation | 61 | 3D & motion | |
| Photography | 58 | Photography | keep |
| Illustration | 43 | Illustration | keep |
| Product Design | 29 | Product design | keep |
| Artist | 22 | Art practice | capability-phrased |
| Creative Technologist | 22 | Creative technology | |
| Film / Production | 20 | Film & video production | |
| Printer | 17 | Print production | vendor capability |
| Strategy / Research | 16 | Strategy & research | |
| Paper | 15 | Paper & materials | vendor capability |
| Brand design | 14 | Identity systems | per spec example |
| Creative Direction | 13 | Creative direction | keep |
| *Client | 8 | — DROP | relationship fact, lives in Worked Together |
| Consultant | 7 | Strategy & research | role → capability |
| Space | 5 | Spatial & exhibition design | |
| Copywriting | 4 | Copywriting | small but distinct |
| Advertising | 4 | Creative direction | ❓ or keep "Advertising"? |
| Architecture | 4 | Spatial & exhibition design | |
| PR/Marketing | 3 | Strategy & research | ❓ |
| Saas | 3 | — DROP? | ❓ these look like tools/companies, not capabilities — check the 3 entries |
| Manufacturing | 3 | Paper & materials | ❓ or merge with Print production into "Production & fabrication"? |
| Video Games | 2 | Creative technology | |
| Data Visualisation | 2 | Graphic design | ❓ or Creative technology |
| Sound Design | 1 | Film & video production | ❓ or keep "Sound design" |

**Resulting tag list (18):** Graphic design, Identity systems, Type design, Web design,
Can build websites, Creative technology, 3D & motion, Photography, Illustration,
Film & video production, Creative direction, Strategy & research, Copywriting,
Product design, Spatial & exhibition design, Art practice, Print production,
Paper & materials.

❓ = my least confident calls — please confirm or override.

## B. Relationship → Worked Together mapping

| Current value | n | → Worked Together | Note |
|---|---|---|---|
| Partner-Prospect | 226 | Never | |
| Vendor-Prospect | 97 | Never | |
| Partner-Dream | 29 | Never | flagged for you to set Work With? yourself |
| Admirer | 28 | Never | |
| Client-Prospect | 11 | Never | |
| Partner | 18 | ASK per entry | likely Once/Repeatedly — I'll list the 18 names |
| Client | 5 | ASK per entry | Once or Repeatedly |
| Vendor | 1 | ASK per entry | |
| (empty) | 295 | leave empty | unknown ≠ Never; P2 verification fills these over time |

## C. Rating relabel (your existing 70 values → 1–5)

| Current | n | → New |
|---|---|---|
| Fantastic! | 11 | 5 |
| Great! | 26 | 4 |
| Good! | 10 | 3 |
| Only in a pinch | 7 | 2 |
| Not right | 0 | 1 |
| Need to vet | 16 | (clear — it's a status, not a rating; the entry's review cycle covers it) |

## D. Size buckets

Current data: 1 (304) / <10 (200) / <40 (83) / <100 (20) / 100+ (5).
Spec wants: 1 / 2–10 / 11–20 / 21–50 / 51–100 / 100+ — but `<40` can't be split into
11–20 vs 21–50 without re-researching 83 entries.

**Recommendation: keep your buckets, rename for clarity:** `1 / 2–10 / 11–40 / 41–100 / 100+`.
Lossless, objective, one fewer bucket. (Alternative: adopt spec buckets and let P2
verification refine the 83 `<40` entries over the next quarter.)

## E. Properties to retire (values preserved in the CSV backup)

| Property | Usage | Action |
|---|---|---|
| Relationship | 415 | retire after mapping B applied |
| CRM Stage | 58 | retire — replaced by Entry Status |
| CRM Status (formula) | — | retire with CRM Stage |
| Last Contacted | 12 | retire ❓ (or keep if you still use it) |
| For Fuse | 4 ✓ | retire ❓ — what did these mean? |
| For WF | 24 ✓ | retire ❓ — same question |
| Seniority | 1 | retire — Autonomy replaces it |
| URL | 1 | move its one value, retire (Website is the real field, 614 filled) |
| Email | 3 | **KEEP** — objective contact fact, spec just forgot it |

## F. Country stays multi-select (deviation from spec)

34 entries legitimately span countries (Pentagram, Wolff Olins, NR2154…). A single
select would lose facts. Also: what does the `*` option mean (8 entries)? ❓

---

## What happens after approval (no further questions)

1. Add all new properties (Type, Work Status, Works At, Works At Link, Autonomy,
   LinkedIn, Worked Together, Familiarity, Word of Mouth, Work With?, Rating Notes,
   Source, Images, Open Questions, AI Notes, Status Last Verified, Entry Status).
2. Rename Expertise → Capabilities; apply mapping A. Apply B, C, D approved versions.
3. Size = 1 for every Person (Type assignment itself happens in P1 enrichment;
   existing Size=1 entries are the obvious Persons).
4. Move URL's one value; retire section-E properties.
5. Initialise `state/provenance/` for all 710 entries; set all to `Entry Status = Stale`.
6. Write TAXONOMY.md v1 from the approved mapping.
7. You get a checklist for the saved views (Dream partners, Proven core, Never again,
   Review queue).
