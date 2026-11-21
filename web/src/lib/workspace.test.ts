import assert from "node:assert/strict";
import test from "node:test";
import { submissions } from "./fixtures";
import type { Decision } from "./types";
import {
  decisionFor,
  emptyWorkspace,
  isReady,
  parseWorkspace,
  recordDecision,
  draftFor,
  saveReviewDraft,
  validateAddition,
} from "./workspace";

const ready = submissions.find(isReady)!;
const stale = submissions.find((submission) => !isReady(submission))!;
const decision = (fields: Partial<Decision> = {}): Decision => ({
  id: "decision",
  submissionId: ready.id,
  revision: ready.revision,
  action: "approve",
  note: "",
  createdAt: "2026-11-21T00:00:00.000Z",
  ...fields,
});

const details = {
  name: "  Revised name  ",
  role: "Brand designer",
  location: "Unknown",
  workStatus: "Employed" as const,
  capabilities: ["Type design", "Graphic design"] as const,
};
const draftDetails = () => ({
  ...details,
  capabilities: [...details.capabilities],
});

test("Save details persists trimmed fields and sorted capabilities independently of a decision", () => {
  const state = saveReviewDraft(emptyWorkspace, ready, draftDetails());
  const restored = parseWorkspace(JSON.stringify(state));
  assert.equal(restored.decisions.length, 0);
  assert.equal(draftFor(restored, ready)?.details.name, "Revised name");
  assert.deepEqual(draftFor(restored, ready)?.details.capabilities, [
    "Graphic design",
    "Type design",
  ]);
  assert.equal(emptyWorkspace.drafts.length, 0);
});

test("switching proposals and revisions keeps draft details scoped to their own revision", () => {
  const state = saveReviewDraft(
    saveReviewDraft(emptyWorkspace, ready, draftDetails()),
    stale,
    { ...draftDetails(), name: "Another draft" },
  );
  assert.equal(draftFor(state, ready)?.details.name, "Revised name");
  assert.equal(draftFor(state, stale)?.details.name, "Another draft");
  assert.equal(
    draftFor(state, { ...ready, revision: ready.revision + 1 }),
    undefined,
  );
});

test("a second Save details replaces only its own draft", () => {
  const state = saveReviewDraft(
    saveReviewDraft(emptyWorkspace, ready, draftDetails()),
    ready,
    { ...draftDetails(), name: "Latest name" },
  );
  assert.equal(state.drafts.length, 1);
  assert.equal(draftFor(state, ready)?.details.name, "Latest name");
});

test("draft validation rejects blank fields, oversized names and invalid capability values", () => {
  for (const invalid of [
    { name: " " },
    { role: "" },
    { location: "" },
    { name: "x".repeat(121) },
    { capabilities: [] },
  ]) {
    assert.throws(
      () =>
        saveReviewDraft(emptyWorkspace, ready, {
          ...draftDetails(),
          ...invalid,
        }),
      /Keep name/,
    );
  }
});

test("deciding a saved revision consumes only that draft and preserves its edit record", () => {
  const state = saveReviewDraft(
    saveReviewDraft(emptyWorkspace, ready, draftDetails()),
    stale,
    draftDetails(),
  );
  const next = recordDecision(
    state,
    ready,
    decision({
      edits: [{ field: "name", before: "Noor Studio", after: "Revised name" }],
    }),
  );
  assert.equal(draftFor(next, ready), undefined);
  assert.ok(draftFor(next, stale));
  assert.equal(next.decisions[0].edits?.[0].after, "Revised name");
  assert.throws(
    () => saveReviewDraft(next, ready, draftDetails()),
    /already has a decision/,
  );
});

test("old browser state upgrades without deleting decisions or additions", () => {
  const old = {
    version: 1,
    shortlist: ["mina"],
    decisions: [decision()],
    additions: [
      { id: "a", input: "A name", note: "", createdAt: "2026-11-21" },
    ],
  };
  assert.deepEqual(parseWorkspace(JSON.stringify(old)), { ...old, drafts: [] });
});

test("malformed saved drafts cannot crash or erase valid browser state", () => {
  const state = saveReviewDraft(emptyWorkspace, ready, draftDetails());
  const raw = JSON.stringify({
    ...state,
    drafts: [
      null,
      {},
      { submissionId: "x", revision: 1, details: null },
      ...state.drafts,
    ],
  });
  assert.deepEqual(parseWorkspace(raw), state);
});

test("clean sandbox has two ready entries, one stale check, and no stored decisions", () => {
  assert.equal(submissions.filter(isReady).length, 2);
  assert.equal(
    submissions.filter((submission) => !isReady(submission)).length,
    1,
  );
  assert.deepEqual(parseWorkspace(null), emptyWorkspace);
});
test("approval is bound to an independently checked revision", () => {
  assert.throws(
    () =>
      recordDecision(
        emptyWorkspace,
        stale,
        decision({ submissionId: stale.id, revision: stale.revision }),
      ),
    /independent check/,
  );
  assert.throws(
    () =>
      recordDecision(
        emptyWorkspace,
        ready,
        decision({ revision: ready.revision + 1 }),
      ),
    /revision changed/,
  );
  assert.throws(
    () =>
      recordDecision(
        emptyWorkspace,
        { ...ready, reviewer: { ...ready.reviewer, verdict: "fail" } },
        decision(),
      ),
    /independent check/,
  );
});
test("duplicate decisions cannot be recorded", () => {
  const state = recordDecision(emptyWorkspace, ready, decision());
  assert.equal(decisionFor(state, ready)?.action, "approve");
  assert.throws(
    () => recordDecision(state, ready, decision()),
    /already has a decision/,
  );
  assert.equal(emptyWorkspace.decisions.length, 0);
});
test("decline and request changes require a substantive note", () => {
  for (const action of ["reject", "request-changes"] as const) {
    assert.throws(
      () =>
        recordDecision(
          emptyWorkspace,
          ready,
          decision({ action, note: "   " }),
        ),
      /Add a reason/,
    );
    assert.equal(
      recordDecision(
        emptyWorkspace,
        ready,
        decision({ action, note: "  Need more work examples  " }),
      ).decisions[0].note,
      "Need more work examples",
    );
  }
});
test("decisions preserve saved before/after edits through a storage round trip", () => {
  const saved = decision({
    edits: [{ field: "Role", before: "Designer", after: "Brand designer" }],
  });
  const state = recordDecision(emptyWorkspace, ready, saved);
  assert.deepEqual(parseWorkspace(JSON.stringify(state)), state);
});
test("corrupt or incompatible storage safely falls back", () => {
  for (const raw of ["{", "null", "[]", '{"version":2}'])
    assert.deepEqual(parseWorkspace(raw), emptyWorkspace);
  const state = parseWorkspace(
    JSON.stringify({
      ...emptyWorkspace,
      decisions: [null, { ...decision(), edits: [null] }],
      additions: [null],
      shortlist: ["mina", 3],
    }),
  );
  assert.deepEqual(state, { ...emptyWorkspace, shortlist: ["mina"] });
});
test("Add for review validates names, URLs, length and unsupported schemes", () => {
  for (const value of [
    "",
    "a",
    "x".repeat(501),
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/plain,hi",
    "https:",
  ])
    assert.ok(validateAddition(value), value);
  for (const value of [
    "Mina Vale",
    "https://example.com/work",
    "http://example.com",
  ])
    assert.equal(validateAddition(value), null, value);
});
