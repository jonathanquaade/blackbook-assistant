# sources.md — scout source list (P3)

Domains the scout may crawl (also part of the browser allowlist). One per line,
with what to look for. Jonathan: add/remove freely — the scout reads this file
each run.

| Source | URL | What to scout |
|---|---|---|
| It's Nice That | https://www.itsnicethat.com | featured creatives & studios, all disciplines |
| BP&O | https://bpando.org | identity work — studios and designers |
| Brand New (UnderConsideration) | https://www.underconsideration.com/brandnew/ | identity programmes; note studio credits |
| Fonts In Use | https://fontsinuse.com | type designers, foundries, designers credited in uses |

Candidates for Jonathan to approve before the scout uses them:
- siteInspire (web design) — https://www.siteinspire.com
- Hoverstat.es (independent web) — https://www.hoverstat.es
- The Brand Identity — https://the-brandidentity.com
- Agency/studio team pages worth re-checking (add specific URLs here)

Rules (binding, see CLAUDE.md):
- New finds go to the Candidates DB, never straight to the main DB.
- Dedupe against main DB by name + domain before proposing.
- `Rejected` candidates are never re-proposed.
- Last-run cursor: state/scout-last-run.json
