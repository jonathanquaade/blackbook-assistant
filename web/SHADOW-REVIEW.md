# Private shadow review

`/review` remains the credential-free fictional sandbox. `/review/blackbook` is a
separate, owner-gated review surface. Default operation is disconnected, with no
private data rendered or bundled. Reviewer autonomy is always L0, even if an
imported report records L1–L3 at review time. There is no promotion or publish code.

## Private server setup

Set these **server-only** environment variables before starting Next:

| Variable                      | Purpose                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `BLACKBOOK_OWNER_SECRET`      | Random owner key, at least 32 characters. Deliver through a secure secret channel, never URLs or git.               |
| `BLACKBOOK_OWNER_ORIGIN`      | Exact browser origin, such as the deployed App's HTTPS origin, without a trailing slash. Required for all POSTs.    |
| `BLACKBOOK_REVIEW_DATA_DIR`   | Absolute durable state directory, normally the repository's `state/`, outside the immutable build/release.          |
| `BLACKBOOK_REVIEW_ASSETS_DIR` | Optional absolute repository `assets/` directory for manifest captions, source links and rejected-image exclusions. |
| `NOTION_API_KEY`              | Existing Notion integration key, server only. A read-only integration is recommended.                               |
| `NOTION_DATABASE_ID`          | Existing Blackbook database ID.                                                                                     |

The App's organisation-wide access is **not** sufficient to read private entries.
The owner key is exchanged for an eight-hour HttpOnly, SameSite=Strict cookie
(Secure on the configured HTTPS origin). Sign-out clears it. Rotate the key to
invalidate all sessions. Sign-in is rate limited; mutations require the exact
configured origin. This is a single-owner internal tool, not multi-user SSO.
Do not enable it on an unencrypted public origin.

Queue reads use the existing Notion 2022-06-28 database query API, with pagination
over every Needs Review entry. Detail reads refresh signed image URLs from Notion.
The only Notion methods are GET page and POST **database query**, never a page or
block mutation. Pages outside this database or no longer Needs Review are refused.
Remote media is shown directly in the owner's browser with no referrer. Missing,
expired and rejected media is not replaced with unrelated work.

## Reviewer revision contract

`reviewed_revision` is `Date.parse(page.last_edited_time)`, an integer epoch
millisecond timestamp from the exact Notion page the reviewer inspected. Fresh
reports must include the live-check object with integer `blocks` and `images`,
boolean `h2_work`, and an ISO `checked_at` no earlier than that page revision.
Approval is blocked for missing reports, missing revision/live metadata, and stale
revisions. An `unsure` check forces Needs you. A human can override a fresh failure
by explicitly naming the completeness checks they correct.

Existing report files still render. Missing metadata never earns trust. Legacy
nonstandard result strings render as `unsure` with the original result in evidence;
unknown kinds default to reviewer reads, never mechanical rules. Legacy IDs are
preserved. Duplicate IDs or contradictory groups make the report unreadable.

Reports are read from `<data-dir>/review-feedback/<page-id>.json` and never edited.
The UI shows verdict, effective route, handover reason, attempts, responsible doer,
trust at review, summary, live metadata, grouped checks, evidence and fixes.
Rating, Work With?, Worked Together, Familiarity and Notes are source fields,
read-only and separate from reviewer output. No profile-property payload is accepted.

## Training and private decisions

- Every check response and decision appends to `<data-dir>/owner-review.jsonl`.
- Disagreements also append to `<data-dir>/reviewer-corrections.jsonl` as
  `{date,page_id,revision,check,you_said,he_said,note,event_id}`. `you_said` is the
  reviewer result; `he_said` is Jonathan's correction. Agreement is retained in
  the owner journal as a denominator for later calibration, not as a correction.
- Completeness decisions name their affected checks. Taste declines do not teach
  a completeness failure. Approving a reviewer failure requires named corrections.
- Revision and report-content hashes are rechecked at save time. Request IDs are
  idempotent. The server serializes saves with a directory lock and fsyncs appends.
  Retrying after an interrupted append does not duplicate corrections for that
  request. A process crash can leave `.owner-review-lock`; remove it only after
  confirming no save process is running. This local store is not a hosted database.
- State survives browser reload, device changes and immutable release rebuilds
  when the same durable state directory is mounted. Back it up separately. The
  owner journal is gitignored; this PR contains no real decisions or corrections.

Notion status stays Needs Review after a private decision. Neither approval nor
disagreement sets Verified, publishes, edits judgment, or starts pipeline work.

## Safe fictional QA

Create a **new empty directory**, then run the fixture generator with the intended
server origin:

```sh
cd web
npx tsx scripts/shadow-fixture.ts /absolute/new/fixture-directory http://localhost:3003
```

Set `BLACKBOOK_REVIEW_DATA_DIR` to that directory, `BLACKBOOK_SHADOW_FIXTURES=1`,
an arbitrary fictional owner key of at least 32 characters, and
`BLACKBOOK_OWNER_ORIGIN=http://localhost:3003`. No Notion key is needed or used.
The four cases are a current pass, a current failure, a legacy untrusted report,
and an unsure handover. All profiles and the artwork are fictional. Never point
fixture setup at real state. Stop the fixture server before enabling real reads.

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` for shell
verification. Production UI testing must use an immutable release on a separate
port; never rebuild the `.next` directory used by a live server.
