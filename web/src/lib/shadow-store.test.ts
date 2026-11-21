import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createShadowFixtures } from "./shadow-fixtures";
import {
  readPage,
  reviewEvents,
  reviewQueue,
  saveOwnerEvent,
  shadowEntry,
} from "./shadow-store";

test("private review persists agreements, corrections and decisions without touching source pages or reports", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "blackbook-shadow-test-"));
  const before = {
    dir: process.env.BLACKBOOK_REVIEW_DATA_DIR,
    fixture: process.env.BLACKBOOK_SHADOW_FIXTURES,
  };
  try {
    const pages = await createShadowFixtures(dir, "http://localhost:3003");
    process.env.BLACKBOOK_REVIEW_DATA_DIR = dir;
    process.env.BLACKBOOK_SHADOW_FIXTURES = "1";
    const queue = await reviewQueue();
    assert.equal(queue.entries.length, 4);
    assert.equal(queue.fictional, true);
    const entry = await shadowEntry(await readPage(pages[0].id));
    const pageBefore = await readFile(path.join(dir, "pages.json"), "utf8");
    const reportPath = path.join(
        dir,
        "review-feedback",
        `${entry.page_id}.json`,
      ),
      reportBefore = await readFile(reportPath, "utf8");
    const agreement = {
      id: randomUUID(),
      page_id: entry.page_id,
      revision: entry.revision,
      report_hash: entry.report_hash,
      action: "check" as const,
      check: "B.type",
      result: "pass" as const,
      checks: [],
      note: "",
    };
    await saveOwnerEvent(agreement);
    assert.equal((await reviewEvents()).length, 1);
    const disagreement = {
      ...agreement,
      id: randomUUID(),
      check: "A.context-shots",
      result: "fail" as const,
      note: "This is not a context shot.",
    };
    await saveOwnerEvent(disagreement);
    await saveOwnerEvent(disagreement);
    const corrections = (
      await readFile(path.join(dir, "reviewer-corrections.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(corrections.length, 1);
    assert.equal(corrections[0].he_said, "fail");
    assert.equal((await reviewEvents()).length, 2);
    await assert.rejects(
      saveOwnerEvent({
        ...disagreement,
        id: randomUUID(),
        revision: entry.revision + 1,
      }),
      /changed/,
    );
    await writeFile(reportPath, `${reportBefore}\n`);
    await assert.rejects(
      saveOwnerEvent({ ...disagreement, id: randomUUID() }),
      /changed/,
    );
    await writeFile(reportPath, reportBefore);
    await saveOwnerEvent({
      ...agreement,
      id: randomUUID(),
      action: "reject",
      reason: "taste",
      note: "Not my fit.",
    });
    await assert.rejects(
      saveOwnerEvent({
        ...agreement,
        id: randomUUID(),
        action: "approve",
        reason: "taste",
      }),
      /already saved/,
    );
    assert.equal(
      await readFile(path.join(dir, "pages.json"), "utf8"),
      pageBefore,
    );
    assert.equal(await readFile(reportPath, "utf8"), reportBefore);
    assert.equal(
      (await reviewQueue()).events.filter((e) => e.action !== "check").length,
      1,
    );
  } finally {
    if (before.dir === undefined) delete process.env.BLACKBOOK_REVIEW_DATA_DIR;
    else process.env.BLACKBOOK_REVIEW_DATA_DIR = before.dir;
    if (before.fixture === undefined)
      delete process.env.BLACKBOOK_SHADOW_FIXTURES;
    else process.env.BLACKBOOK_SHADOW_FIXTURES = before.fixture;
    await rm(dir, { recursive: true, force: true });
  }
});
