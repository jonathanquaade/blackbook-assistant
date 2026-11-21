# Blackbook acceptance examples: slices 1 and 2

Concrete, testable examples for the two build slices in the Blackbook build plan. Each example is Given / When / Then and uses real entries from `backups/latest.csv` (Nov 20 snapshot). The briefs referenced as B01 to B20 are in [shortlist-benchmark.md](shortlist-benchmark.md).

Plan-wide: v1 is Jonathan only. No collaborator invites, public sharing, outreach, vector-only search, fine-tuning, or replacing Notion.

## Slice 1: Private Explore

Ships: ingest the Verified cohort, hydrate allowed thumbnails, brief input, filters, evidence-backed cards, local private shortlists.

### Gate

| Check | Pass when |
|---|---|
| Benchmark | A grade 2 or 3 entry is in the top 5 for at least 13 of the 16 `pilot` briefs (80%). Scored by a script reading `shortlist-benchmark.json`. |
| Coverage | Reported separately: the 4 `catalog` briefs (B17 to B20) and the share of the 862 rows not yet searchable. |
| Zero results | Every zero-result example below passes. |
| Speed | p95 time from submit to first cards is 3 s or less over 20 runs of the 20 briefs. |

### Ingest and thumbnails

1. **Only Verified entries.** Given the snapshot (45 Verified, 812 Needs Review, 1 Rejected, 4 blank), when the pilot ingests, then the index holds the 45 Verified pages and nothing else. Searching "Charlie Nash" (Needs Review) or "__search_test__" (Rejected) returns no card.
2. **Duplicates collapse.** Paul Lacour has two Verified pages. Brief B04 shows him once, with both source pages linked.
3. **Allowed thumbnails only.** A card shows images from the entry's Images property (real uploads). An entry with no images (2 of the 45) shows a calm placeholder with its name, not a broken image or a scraped external link.
4. **Video entries.** Vincenzo Marchese Ragona's work is film: his card shows the poster frame with a play marker, not a blank tile.
5. **Ingest is read-only.** Running ingest makes zero Notion write calls (asserted by a test that fails on any write).

### Brief input and interpretation

6. **Editable interpretation.** When Jonathan types B01 "Find freelance designers for a type-led food packaging project", then chips appear above the results: Work status Freelance, Type design, Identity systems, packaging. Removing the Freelance chip reruns the search and Morgan Light (Employed) may then appear.
7. **Freelance is not availability.** For B06 "...next week", the interpretation says "Availability: unknown, confirm directly". No card says or implies "available".
8. **Location as a filter.** B05 adds a Location chip (France, UK). Elodie Fabbri (France) and Sandra Autukaite (UK) appear; Laura Piccolo (Germany) does not, unless the chip is removed.
9. **Relationship filter.** B06 maps "worked with repeatedly" to Worked Together = Repeatedly. Every card shown has that value.

### Evidence-backed cards

10. **Why this fits is cited.** Each card has 1 to 3 "Why this fits" lines, each tied to a stored field or AI Notes sentence. Example for Lex Carthur on B10: "Athlete brand films for Nike, Adidas, On, Rapha (AI Notes)". A line with no source is a test failure.
11. **No invented facts.** If a field is empty (e.g. Day Rate for most entries), the card omits it. It never says "rate unknown, likely £500".
12. **Private notes stay private.** Jonathan's Notes, Email and Day Rate are never sent to a model provider. A network test on B01 to B20 asserts none of those field values leaves the box.
13. **Distinct projects.** Thumbnails on one card come from different projects where the entry has them; three angles of one project are not shown as three works.
14. **Source links.** Every card links to its Notion page and the entry's website or Instagram.

### Shortlists

15. **Local private shortlist.** Saving Leonhard Laupichler and Daan Rietbergen from B02 into "Challenger rebrand" persists after reload, only in Jonathan's account. Nothing is written to Notion.
16. **Shortlist keeps the reason.** The saved shortlist shows the brief and each card's "Why this fits" as it was when saved.

### Zero and weak results

17. **Catalog-only brief.** B17 "Creative technologist for an interactive installation in London" on the pilot returns: "No strong match in your Verified entries." with two actions: include Needs Review entries, or remove the London filter. It does not show Fernanda Ruiz as a creative technologist.
18. **Impossible constraint.** "Freelance Arabic type designer based in Japan" returns zero cards and names the constraint to relax (location). It does not silently drop the constraint.
19. **No silent substitution.** With "include Needs Review" on, Mat Hill appears for B17 with a visible "Not yet verified" badge, ranked in a separate group below any Verified match.
20. **Gibberish.** "asdf qwer" returns an empty state with example briefs, not an error.

## Slice 2: Review and feedback

Ships: submission, Ready / Needs a check queues, immutable diff and decisions, targeted resubmission. Trial 20 legacy entries, ranked by human signals and completeness, not bulk approval. Sandbox writeback first.

### Review screen layout (Jonathan, 2026-11-21)

21. **Profile layout.** Opening an entry shows the work large on the right two-thirds (swipeable, like a dating-app profile) and the information on the left third. On mobile the work is on top and the information below.
22. **Edit before deciding.** Fields on the left are editable in place (e.g. change Capabilities on Salome Frenzel from Identity systems to Graphic design). The edit shows in the diff before approval.
23. **Approve or decline with reason.** The two primary actions are Approve and Decline. Decline requires a reason (free text or a quick pick such as "wrong person", "weak work", "duplicate") before it can be sent.

### Queues and the legacy trial

24. **Two queues.** A complete, reviewer-passed draft goes to "Ready for you". A draft with an Open Question, Work Status Unknown, or fewer than 3 images goes to "Needs a check" with the reason shown. Example: Marcos Santos (Work Status Unknown) lands in Needs a check.
25. **Trial ranking.** The 20 legacy trial entries are picked from Needs Review, ranked by Jonathan's signals first (Rating, Work With?, Worked Together), then completeness. Jack Llewellyn (Rating 5, Definitely, Repeatedly) and Mat Hill (Rating 5, Repeatedly) rank above an Unvetted entry with no rating.
26. **No bulk approve.** There is no "approve all" or multi-select approve. Each approval is one entry, one click, after its diff is shown.

### Decisions

27. **Approve.** Approving Harry Boyd's draft records an immutable decision (who, when, revision id, diff) and, in sandbox, sets Entry Status to Verified on the sandbox copy only.
28. **Reject a new entry.** Declining a new entry as "wrong person" marks it Rejected. It never reappears in Explore or either queue, and a re-scout of the same URL is blocked.
29. **Reject an update, keep the profile.** Declining a proposed update to an already Verified entry (e.g. a new Works At for Yedo Han) discards only that update. The approved profile and Explore card are unchanged.
30. **Change request.** Requesting changes on Charlie Nash (Needs Review) with "more type specimens, fewer Instagram crops" sets the draft to Revisit with that instruction scoped to Images. Other fields are not re-enriched.
31. **Resubmit.** The resubmitted Charlie Nash draft shows only the changed fields (Images) in the diff, with the original instruction beside it, and returns to Ready for you.

### Safety

32. **Owner-only mutations.** Any approve, decline, edit or change request from a session that is not Jonathan returns 403 and writes nothing. Explore read access for anyone else is also refused in v1.
33. **No leaks.** Drafts, rejected entries and declined updates never appear in Explore, shortlists, or search suggestions. A test seeds one of each and searches every benchmark brief.
34. **Stale decision.** If the draft changed after Jonathan opened it (new revision from a scout pass), Approve stops and shows the fresh diff. Approving the old revision is impossible.
35. **Double-click.** Clicking Approve twice quickly records one decision and one write. The second click is a no-op.
36. **Failed sync.** If the sandbox Notion write fails, the decision is kept as "approved, not synced", the card shows a retry, and the last good revision stays live in Explore.
37. **Conflict.** If the Notion page was edited by Jonathan directly since the draft was made, writeback stops and shows both versions. Fields marked `set_by: jonathan` are never overwritten.
38. **Rollback.** Rolling back an approval restores the previous revision in the sandbox page and in Explore, and records the rollback as its own decision.
39. **Sandbox first.** All writeback in slice 2 targets a sandbox copy of the Companies database. Production writeback is a separate switch, off by default, and not enabled in this slice.
