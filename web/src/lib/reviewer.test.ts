import assert from "node:assert/strict";
import test from "node:test";
import {
  approvalIssue,
  entryRoute,
  orderedChecks,
  parseReviewerReport,
  safeUrl,
  trainingCorrections,
  type OwnerReviewEvent,
  type ShadowEntry,
} from "./reviewer";
import {
  configuredSecret,
  ownerKeyMatches,
  ownerSession,
  sameOwnerOrigin,
  validOwnerSession,
} from "./owner-session";
import { pageRevision, parseOwnerEvent, requirePageId } from "./shadow-store";

const revision = Date.parse("2026-11-20T09:00:00Z");
const raw = {
  verdict: "pass",
  route: "ready",
  reviewed_revision: revision,
  reviewed_at: "2026-11-20T10:00:00Z",
  attempt: 1,
  to: "keeper",
  trust_level: "L0",
  live: {
    blocks: 12,
    images: 6,
    h2_work: true,
    checked_at: "2026-11-20T10:00:00Z",
  },
  summary: "Ready for Jonathan.",
  checks: [
    {
      id: "A.context-shots",
      group: "A",
      kind: "read",
      result: "pass",
      evidence: "Context image: https://example.com/image.png",
    },
    {
      id: "B.type",
      group: "B",
      kind: "rule",
      result: "pass",
      evidence: "A person.",
    },
  ],
};
export function exampleEntry(): ShadowEntry {
  return {
    page_id: "11111111-1111-4111-8111-111111111111",
    name: "Mina Vale",
    revision,
    edited_at: "2026-11-20T09:00:00Z",
    type: "Person",
    location: "London",
    work_status: "Freelance",
    capabilities: ["Graphic design"],
    summary: "Fictional profile.",
    questions: "",
    notes: "",
    judgments: {
      Rating: "5",
      "Work With?": "Yes",
      "Worked Together": "Once",
      Familiarity: "Know them well",
    },
    links: [],
    images: [],
    report: parseReviewerReport(raw),
    report_hash: "a".repeat(64),
  };
}
function event(overrides: Partial<OwnerReviewEvent> = {}): OwnerReviewEvent {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    date: "2026-11-20T11:00:00Z",
    page_id: exampleEntry().page_id,
    revision,
    report_hash: "a".repeat(64),
    action: "check",
    check: "A.context-shots",
    result: "fail",
    checks: [],
    note: "Not the correct Instagram profile.",
    ...overrides,
  };
}
test("new reports preserve check groups, kind, evidence, trust-at-review and read-only claims", () => {
  const report = parseReviewerReport({
    ...raw,
    trust_level: "L3",
    Rating: 1,
    "Work With?": "No",
  })!;
  assert.equal(report.trust_level, "L3");
  assert.equal(report.checks[0].kind, "read");
  assert.equal("Rating" in report, false);
  assert.equal(approvalIssue(exampleEntry()), null);
  assert.equal(entryRoute(exampleEntry()), "ready");
});
test("legacy reports still parse but cannot be promoted to trusted passes", () => {
  const legacy = parseReviewerReport({
    verdict: "pass",
    checks: [
      { id: "A.context-shots", result: "pass", evidence: "Old evidence." },
    ],
    notes: "Old summary.",
  })!;
  assert.equal(legacy.checks[0].group, "A");
  assert.equal(legacy.checks[0].kind, "read");
  assert.equal(legacy.route, "needs_you");
  assert.equal(legacy.handover_reason, "untrusted_check");
  assert.ok(approvalIssue({ ...exampleEntry(), report: legacy }));
});
test("unsure checks force handover and failures sort first without mutating the report", () => {
  const report = parseReviewerReport({
    ...raw,
    checks: [
      ...raw.checks,
      { id: "A.depth", result: "unsure" },
      { id: "A.caption", result: "fail", fix: "Add a caption." },
    ],
  })!;
  assert.equal(report.route, "needs_you");
  assert.equal(report.handover_reason, "unverifiable");
  assert.equal(orderedChecks(report.checks)[0].id, "A.caption");
  assert.equal(report.checks[0].id, "A.context-shots");
});
test("stale revisions and live checks older than the entry block approval", () => {
  assert.match(
    approvalIssue({ ...exampleEntry(), revision: revision + 1 })!,
    /stale/,
  );
  const entry = exampleEntry();
  entry.report!.live!.checked_at = "2026-11-19T10:00:00Z";
  assert.match(approvalIssue(entry)!, /stale/);
  assert.equal(entryRoute(entry), "needs_you");
});
test("malformed, duplicate or cross-group checks are untrusted, not silently dropped", () => {
  assert.equal(
    parseReviewerReport({ ...raw, checks: [...raw.checks, raw.checks[0]] }),
    null,
  );
  assert.equal(
    parseReviewerReport({ ...raw, checks: [{ ...raw.checks[0], group: "B" }] }),
    null,
  );
  assert.equal(
    parseReviewerReport({
      ...raw,
      checks: [{ id: "A.context-shots", result: "maybe" }],
    })?.checks[0].result,
    "unsure",
  );
  assert.ok(
    approvalIssue({
      ...exampleEntry(),
      report: parseReviewerReport({ ...raw, checks: [] }),
    }),
  );
});
test("disagreements produce the exact training signal while agreements do not", () => {
  const corrections = trainingCorrections(exampleEntry(), event());
  assert.equal(corrections.length, 1);
  assert.deepEqual(corrections[0], {
    date: event().date,
    page_id: event().page_id,
    revision,
    check: "A.context-shots",
    you_said: "pass",
    he_said: "fail",
    note: event().note,
    event_id: event().id,
  });
  assert.deepEqual(
    trainingCorrections(exampleEntry(), event({ result: "pass" })),
    [],
  );
});
test("entry and report changes invalidate feedback, including identical check ids", () => {
  assert.throws(
    () =>
      trainingCorrections(exampleEntry(), event({ revision: revision + 1 })),
    /changed/,
  );
  assert.throws(
    () =>
      trainingCorrections(
        exampleEntry(),
        event({ report_hash: "b".repeat(64) }),
      ),
    /changed/,
  );
  assert.throws(
    () => trainingCorrections(exampleEntry(), event({ check: "A.missing" })),
    /valid check/,
  );
});
test("completeness decisions name corrections, taste decisions do not train the gate", () => {
  assert.throws(
    () =>
      trainingCorrections(
        exampleEntry(),
        event({ action: "reject", reason: "completeness", checks: [] }),
      ),
    /Name the checks/,
  );
  assert.equal(
    trainingCorrections(
      exampleEntry(),
      event({
        action: "reject",
        reason: "completeness",
        checks: ["A.context-shots"],
      }),
    )[0].he_said,
    "fail",
  );
  assert.deepEqual(
    trainingCorrections(
      exampleEntry(),
      event({ action: "reject", reason: "taste" }),
    ),
    [],
  );
  assert.throws(
    () =>
      trainingCorrections(
        exampleEntry(),
        event({ action: "reject", reason: "taste", note: " " }),
      ),
    /Add a reason/,
  );
});
test("a human can override a fresh reviewer failure with named completeness corrections", () => {
  const entry = exampleEntry();
  entry.report!.verdict = "fail";
  entry.report!.checks[0].result = "fail";
  assert.throws(
    () =>
      trainingCorrections(
        entry,
        event({ action: "approve", reason: "completeness" }),
      ),
    /Name the checks/,
  );
  assert.equal(
    trainingCorrections(
      entry,
      event({
        action: "approve",
        reason: "completeness",
        checks: ["A.context-shots"],
      }),
    )[0].he_said,
    "pass",
  );
  assert.throws(
    () =>
      trainingCorrections(
        entry,
        event({
          action: "approve",
          reason: "taste",
          checks: ["A.context-shots"],
        }),
      ),
    /completeness/,
  );
});
test("training leaves every protected judgment and the source report untouched", () => {
  const entry = exampleEntry(),
    before = JSON.stringify(entry);
  trainingCorrections(entry, event());
  assert.equal(JSON.stringify(entry), before);
  const { action, date, ...input } = event();
  void date;
  assert.equal(parseOwnerEvent({ ...input, kind: action }).action, "check");
  for (const field of [
    "Rating",
    "Worked Together",
    "Familiarity",
    "Work With?",
    "Notes",
    "Entry Status",
    "Verified",
  ])
    assert.throws(
      () => parseOwnerEvent({ ...input, kind: action, [field]: "changed" }),
      /cannot be written/,
    );
});
test("external evidence rejects executable URLs and ids reject filesystem traversal", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("https://user:pass@example.com"), undefined);
  assert.equal(safeUrl("https://example.com/work"), "https://example.com/work");
  assert.throws(() => requirePageId("../../secrets"));
  assert.equal(
    pageRevision({ last_edited_time: "2026-11-20T09:00:00Z" }),
    revision,
  );
});
test("owner sessions require a strong configured secret, signature, lifetime and exact origin", () => {
  const key = "fixture-owner-key-not-for-real-use-12345",
    now = Date.now();
  assert.equal(configuredSecret("short"), null);
  assert.equal(ownerKeyMatches(key, key), true);
  assert.equal(ownerKeyMatches("wrong", key), false);
  const token = ownerSession(key, now);
  assert.equal(validOwnerSession(token, key, now + 1), true);
  assert.equal(validOwnerSession(token, key, now + 9 * 60 * 60 * 1000), false);
  assert.equal(validOwnerSession(token, key + "x", now), false);
  assert.equal(validOwnerSession(token + "x", key, now), false);
  assert.equal(sameOwnerOrigin(null, "https://example.com"), false);
  assert.equal(
    sameOwnerOrigin("https://example.com.evil.test", "https://example.com"),
    false,
  );
  assert.equal(
    sameOwnerOrigin("https://example.com", "https://example.com"),
    true,
  );
});
