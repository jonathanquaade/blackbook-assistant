# Scout metadata-cleanup checklist

A LIGHT scout pass for backlog entries that were scouted thinly (Phase-0 / early
backfill) and are now being driven through the scraper -> reviewer gate. Run BEFORE the
scraper so the gate does not bounce the entry on pure-documentation gaps (Jonathan,
2026-06-18: a wave of scraped entries failed the gate ~65% of the time, almost all on
the recurring scout-side gaps below, doubling cost per entry. Fixing the metadata first
is cheaper than bouncing after the scrape).

You are the SCOUT. Touch only metadata (never images). Leave the entry in Enriching.
Read the entry first: `keeper.py get <id>`. Apply every item that is missing or stale.
Respect the contract: 0.8 confidence floor (empty + one Open Question beats a guess),
never write judgment fields beyond zero-states, never set Verified, no em-dashes.

## The recurring gaps (fix each, in order)

1. **Autonomy as the FIELD, not just prose.** If AI Notes discusses seniority/autonomy
   but the Autonomy property is empty, set it (1-5, `set_by: agent`) with the reasoning
   already in AI Notes. The field is what is decision-relevant; prose alone fails the gate.

2. **LinkedIn.** If empty, search ("<name> <discipline> linkedin"; for studios the
   company page "/company/<slug>"). Capture from the Google snippet, no login. Genuinely
   none after a real search -> say so in AI Notes (one sentence). A missing link is almost
   always a skipped search.

3. **Public Email.** Check the person's/studio's own site /contact and the snippet. A
   public contact email only (hello@studio, name@domain) — never a scraped private/work
   address. None found -> note it in AI Notes.

4. **Instagram search documented.** If Instagram is empty, AI Notes must state the
   handle variants tried and that none was confirmed (NOT silence). If a handle IS
   confirmed (bio + grid match the right person), set the field. Never attach an
   unverified or wrong-person handle.

5. **Clear stale / answered Open Questions.** If an Open Question asks for a field that
   now has a non-zero-state value (e.g. "Instagram?" but IG is attached; a resolved
   action-item written as a question), CLEAR it. Renumber the survivors. Per CLAUDE.md:
   never ask for a field that already has a value; fully answered -> clear the property.
   (Do NOT clear Jonathan's own revisit instructions.)

6. **Source filled.** Never empty on a completed entry. Clip note provenance verbatim,
   else "Web clipper, <created date>".

7. **Work Status sourcing in AI Notes.** If Work Status is set, AI Notes should name the
   sources checked and why (the objective multi-source rule). If it is Unknown, that is
   honest; leave it.

## Apply
Use `keeper.py set` with the payload routed through `@file` or stdin (never inline JSON —
the brace-quote / newline-# shell guards). Open Questions via `set` (the "Open Questions"
field), NOT `ask` (which would flip status). Leave Entry Status = Enriching. Report what
you filled, what you documented as genuinely-absent, and any handle you confirmed.

## When this is a re-bounce from the reviewer
If `state/review-feedback/<id>.json` exists with `verdict: fail`, read its failing checks
and `fix` text first and resolve those specifically, THEN run this checklist for anything
else missing. The reviewer sometimes routes a scout-metadata fix as `to: scraper` — if a
"scraper" fix is actually a metadata field (Autonomy, LinkedIn, Email, AI Notes, Open
Questions), it is yours; do it here.
