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
