# sources.md — scout source list (P3)

Domains the scout may crawl (also part of the browser allowlist). One per line,
with what to look for. Jonathan: add/remove freely — the scout reads this file
each run.

**Primary source = the studio roster, not these feeds.** The scout's main loop cycles
the maintained studios (Rating 4–5) in `state/roster/` and diffs each studio's team
page for new hires (`roster.py snapshot`). The team pages of maintained studios are
allowed scout targets by definition (they are the roster). The feeds below are the
*secondary* source — they surface people and studios not yet on the roster.

| Source | URL | What to scout |
|---|---|---|
| It's Nice That | https://www.itsnicethat.com | featured creatives & studios, all disciplines |
| BP&O | https://bpando.org | identity work — studios and designers |
| Brand New (UnderConsideration) | https://www.underconsideration.com/brandnew/ | identity programmes; note studio credits |
| Fonts In Use | https://fontsinuse.com | type designers, foundries, designers credited in uses |
| Young Guns (The One Club) | https://www.oneclub.org/awards/youngguns/-archive/awards/2025/all | under-30 winners across all disciplines, high-signal talent pool (e.g. Jump Jirakaweekul, Zuzanna Rogatty). NOT just the latest year: scout EVERY year. youngguns.org/finalists is only the current edition; the full winners archive is per-year at oneclub.org/awards/youngguns/-archive/awards/{YEAR}/all — iterate YEAR back through 2025, 2024 … to ~2003 (editions YG23 … YG1). Each winner profile links out to their site/socials. |

Candidates for Jonathan to approve before the scout uses them:
- siteInspire (web design) — https://www.siteinspire.com
- Hoverstat.es (independent web) — https://www.hoverstat.es
- The Brand Identity — https://the-brandidentity.com
- Agency/studio team pages worth re-checking (add specific URLs here)

Rules (binding, see CLAUDE.md):
- New finds go to the roster (status Surfaced), never straight to the main DB.
  Approved candidates `roster.py promote` into the main DB as `New`.
- Dedupe against the main DB + roster + Rejected by name + domain before proposing.
- `Rejected` candidates are never re-proposed.
- Last-run cursor: state/scout-last-run.json
