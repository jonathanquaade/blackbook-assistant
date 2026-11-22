import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFailureTracker } from "./live/auth";
import { bundleFile, readBundle, writeBundle, type BundledIndex } from "./live/bundle";
import { toBundledEntry } from "./live/build-bundle";
import { collectEntries } from "./live/collect";
import { createEligibilityChecker, EligibilityUnavailableError } from "./live/eligibility";
import { createBundledMediaLookup } from "./live/media";
import { searchEntries } from "./live/memory-search";
import { EMBEDDING_MODEL } from "./live/model";
import { embeddingInputs, projectPage, type NotionPage } from "./live/projection";
import { validateSearchBody } from "./live/request";
import { runBundledSearch } from "./live/service";

const rich = (value: string) => [{ plain_text: value }];
function page(id: string, name: string, extra: { status?: string; rating?: string; employer?: string; link?: string } = {}): NotionPage {
  return {
    id,
    last_edited_time: "2026-11-01T00:00:00.000Z",
    properties: {
      Name: { type: "title", title: rich(name) },
      "Entry Status": { type: "select", select: { name: extra.status ?? "Verified" } },
      Rating: { type: "select", select: { name: extra.rating ?? "5" } },
      Type: { type: "select", select: { name: "Person" } },
      Capabilities: { type: "multi_select", multi_select: [{ name: "Type design" }] },
      "Work Status": { type: "select", select: { name: "Freelance" } },
      Country: { type: "multi_select", multi_select: [{ name: "Germany" }] },
      Notes: { type: "rich_text", rich_text: rich("PRIVATE-NOTE") },
      Email: { type: "email", email: "private@example.com" },
      "Day Rate": { type: "number", number: 987654 },
      "Worked Together": { type: "select", select: { name: "Repeatedly" } },
      "Works At": { type: "relation", relation: extra.employer ? [{ id: extra.employer }] : [] },
      "Works At Link": { type: "url", url: extra.link ?? null },
      Images: { type: "files", files: [{ name: "a.jpg", type: "file" }] },
    },
  };
}
const unit = (index: number) => Array.from({ length: EMBEDDING_MODEL.dims }, (_, i) => (i === index ? 1 : 0));
function bundle(pages: NotionPage[], relationNames: Record<string, string> = {}): BundledIndex {
  return {
    version: 1,
    builtAt: "2026-11-22T00:00:00.000Z",
    source: "test",
    model: EMBEDDING_MODEL.version,
    hasVectors: true,
    entries: pages.map((p, i) => {
      const entry = projectPage(p, [{ file: "a.jpg", caption: "Bakery packaging type" }], relationNames);
      return toBundledEntry(entry, [{ projectIdx: null, embedding: unit(i) }]);
    }),
  };
}
const eligibleNow = (ids: string[], checkedAt = Date.now()) => async () => ({
  ids: new Set(ids),
  ratings: new Map(ids.map((id) => [id, 5])),
  checkedAt,
});
const deps = (index: BundledIndex, eligibility: ReturnType<typeof eligibleNow>) => ({
  index: () => index,
  eligibility,
  embed: async () => unit(0),
});

test("an entry downgraded after the index was built never appears, and the rest still do", async () => {
  const index = bundle([page("1", "Ada"), page("2", "Ben")]);
  const before = await runBundledSearch({ query: "packaging type" }, deps(index, eligibleNow(["1", "2"])));
  assert.deepEqual(before.results.map((r) => r.name).sort(), ["Ada", "Ben"]);
  const after = await runBundledSearch({ query: "packaging type" }, deps(index, eligibleNow(["1"])));
  assert.deepEqual(after.results.map((r) => r.name), ["Ada"]);
  const browse = await runBundledSearch({ query: "" }, deps(index, eligibleNow(["2"])));
  assert.deepEqual(browse.results.map((r) => r.name), ["Ben"]);
  const byId = await runBundledSearch({ query: "", ids: ["1"] }, deps(index, eligibleNow(["2"])));
  assert.deepEqual(byId.results, []);
});

test("a merged entry disappears if any page behind it is no longer eligible", async () => {
  const index = bundle([page("1", "Ada"), page("2", "Ben")]);
  index.entries[0].pageIds = ["1", "9"];
  const result = await runBundledSearch({ query: "" }, deps(index, eligibleNow(["1", "2"])));
  assert.deepEqual(result.results.map((r) => r.name), ["Ben"]);
});

test("the in-memory search re-checks Verified and rating even on entries it is handed", () => {
  const index = bundle([page("1", "Ada")]);
  index.entries[0].rating = 3;
  assert.deepEqual(searchEntries(index.entries, { query: "" }).results, []);
  index.entries[0].rating = 4;
  index.entries[0].status = "Needs Review";
  assert.deepEqual(searchEntries(index.entries, { query: "packaging" }).results, []);
});

test("the live rating and employer eligibility come from the fresh check", async () => {
  const index = bundle([page("1", "Ada", { employer: "e1", link: "https://www.fallback.test/x" })], { e1: "Studio Eleven" });
  assert.equal(index.entries[0].employer, "Studio Eleven");
  const kept = await runBundledSearch({ query: "" }, deps(index, eligibleNow(["1", "e1"])));
  assert.equal(kept.results[0].employer, "Studio Eleven");
  const lost = await runBundledSearch({ query: "" }, deps(index, eligibleNow(["1"])));
  assert.equal(lost.results[0].employer, "fallback.test");
});

test("employer names come only from eligible employer pages (build)", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bb-collect-"));
  const raw = path.join(dir, "backups");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(raw);
  writeFileSync(path.join(raw, "latest-raw.json"), JSON.stringify({ rows: [
    page("p1", "Ada", { employer: "good", link: "https://x.test" }),
    page("p2", "Ben", { employer: "weak", link: "https://weak-fallback.test" }),
    page("good", "Good Studio"),
    page("weak", "Weak Studio", { rating: "3" }),
  ] }));
  const original = process.env.BLACKBOOK_REPO_ROOT;
  process.env.BLACKBOOK_REPO_ROOT = dir;
  try {
    const { entries } = await collectEntries(true);
    const employer = (name: string) => entries.find((entry) => entry.name === name)?.employer;
    assert.equal(employer("Ada"), "Good Studio");
    assert.equal(employer("Ben"), "weak-fallback.test");
    assert.equal(entries.some((entry) => entry.name === "Weak Studio"), false);
  } finally {
    if (original === undefined) delete process.env.BLACKBOOK_REPO_ROOT;
    else process.env.BLACKBOOK_REPO_ROOT = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("eligibility is cached for 60s, tolerated stale for 5 minutes, then fails closed", async () => {
  let t = 0;
  let calls = 0;
  let down = false;
  const checker = createEligibilityChecker(
    async () => {
      calls++;
      if (down) throw new Error("Notion 500");
      return [page("1", "Ada"), page("2", "Ben", { rating: "3" })];
    },
    () => t,
  );
  const first = await checker();
  assert.deepEqual([...first.ids], ["1"]);
  t = 59_000;
  await checker();
  assert.equal(calls, 1);
  down = true;
  t = 61_000;
  assert.deepEqual([...(await checker()).ids], ["1"], "stale but within 5 minutes is allowed");
  t = 5 * 60_000;
  assert.deepEqual([...(await checker()).ids], ["1"]);
  t = 5 * 60_000 + 1;
  await assert.rejects(checker(), EligibilityUnavailableError);
  down = false;
  t += 1;
  assert.deepEqual([...(await checker()).ids], ["1"], "recovers when Notion does");
});

test("with no eligibility result at all, search fails closed instead of serving the index", async () => {
  const index = bundle([page("1", "Ada")]);
  const checker = createEligibilityChecker(async () => { throw new Error("down"); });
  await assert.rejects(runBundledSearch({ query: "" }, deps(index, checker)), EligibilityUnavailableError);
});

test("the query embedding falling back to keyword-only is reported", async () => {
  const index = bundle([page("1", "Ada")]);
  const slow = { ...deps(index, eligibleNow(["1"])), embed: () => new Promise<number[]>(() => {}), embedTimeoutMs: 20 };
  const result = await runBundledSearch({ query: "bakery packaging" }, slow);
  assert.equal(result.mode, "keyword");
  assert.equal(result.modeReason, "model not ready in time");
  assert.deepEqual(result.results.map((r) => r.name), ["Ada"]);
  const ok = await runBundledSearch({ query: "bakery packaging" }, deps(index, eligibleNow(["1"])));
  assert.equal(ok.mode, "hybrid");
  assert.ok(ok.eligibilityCheckedAt && ok.indexBuiltAt);
});

test("the bundled file and API responses hold only allow-listed fields", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bb-bundle-"));
  const original = process.env.BLACKBOOK_INDEX_DIR;
  process.env.BLACKBOOK_INDEX_DIR = dir;
  try {
    const index = bundle([page("1", "Ada")]);
    writeBundle(index);
    const raw = readFileSync(bundleFile(), "utf8");
    assert.doesNotMatch(raw, /PRIVATE-NOTE|987654|private@example|Repeatedly|Day Rate/);
    assert.equal(readBundle()?.entries.length, 1);
    const response = JSON.stringify(await runBundledSearch({ query: "bakery" }, deps(readBundle()!, eligibleNow(["1"]))));
    assert.doesNotMatch(response, /PRIVATE-NOTE|987654|private@example|Repeatedly/);
    assert.ok(embeddingInputs(projectPage(page("1", "Ada"), [])).every((input) => !/PRIVATE-NOTE/.test(input.text)));
  } finally {
    if (original === undefined) delete process.env.BLACKBOOK_INDEX_DIR;
    else process.env.BLACKBOOK_INDEX_DIR = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("request bodies are validated and capped", () => {
  const ok = validateSearchBody({ query: "type", filters: { capability: "Type design" }, muted: ["a"], ids: ["x"], mode: "keyword", extra: "dropped" });
  assert.ok(ok.ok && !("extra" in ok.value));
  for (const body of [null, [], "x", {}, { query: 5 }, { query: "a".repeat(2001) }, { query: "a", filters: [] }, { query: "a", filters: { type: 3 } },
    { query: "a", muted: "x" }, { query: "a", muted: Array(51).fill("a") }, { query: "a", ids: Array(51).fill("a") }, { query: "a", ids: [1] }, { query: "a", mode: "other" }])
    assert.equal(validateSearchBody(body).ok, false, JSON.stringify(body)?.slice(0, 40));
  assert.equal(validateSearchBody({ query: "a", ids: Array(50).fill("a") }).ok, true);
});

test("failed logins are delayed with growing, capped waits and expire", () => {
  let t = 0;
  const tracker = createFailureTracker(() => t, 1000, 2);
  assert.deepEqual([tracker.fail("a"), tracker.fail("a"), tracker.fail("a")], [250, 500, 1000]);
  for (let i = 0; i < 10; i++) tracker.fail("b");
  assert.equal(tracker.fail("b"), 8000);
  tracker.succeed("a");
  assert.equal(tracker.fail("a"), 250);
  t = 5000;
  assert.equal(tracker.fail("b"), 250, "old failures expire");
});

// ---- route-level auth and validation ----

const PASSWORD = "correct-horse-battery-staple-42";
const basic = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;
function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>) {
  const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) setEnv(key, value);
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) setEnv(key, value);
  }
}
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://blackbook.test/api/search", { method: "POST", body, headers: { "x-forwarded-proto": "https", "content-type": "application/json", ...headers } });

test("a password under 20 characters keeps live mode off", async () => {
  const { ownerPassword } = await import("./live/auth");
  await withEnv({ BLACKBOOK_OWNER_PASSWORD: "short-password", BLACKBOOK_REPO_ROOT: os.tmpdir() }, async () => {
    assert.equal(ownerPassword(), null);
    const { POST } = await import("../app/api/search/route");
    const response = await POST(post('{"query":"x"}', { authorization: basic("jonathan:short-password") }));
    assert.equal(response.status, 404);
  });
  await withEnv({ BLACKBOOK_OWNER_PASSWORD: PASSWORD, BLACKBOOK_REPO_ROOT: os.tmpdir() }, async () => {
    assert.equal(ownerPassword(), PASSWORD);
  });
});

test("search and media handlers check the owner themselves, not only the proxy", async () => {
  await withEnv({ BLACKBOOK_OWNER_PASSWORD: PASSWORD, BLACKBOOK_REPO_ROOT: os.tmpdir() }, async () => {
    const { POST } = await import("../app/api/search/route");
    const { GET } = await import("../app/api/media/route");
    assert.equal((await POST(post('{"query":"x"}'))).status, 401);
    assert.equal((await GET(new (await import("next/server")).NextRequest("https://blackbook.test/api/media?page=" + "a".repeat(32) + "&file=a.jpg", { headers: { "x-forwarded-proto": "https" } }))).status, 401);
    const http = new Request("http://blackbook.test/api/search", { method: "POST", body: '{"query":"x"}', headers: { authorization: basic(`jonathan:${PASSWORD}`) } });
    assert.equal((await POST(http)).status, 403);
    // Owner, but a bad body: reaches validation, never the index.
    const owner = { authorization: basic(`jonathan:${PASSWORD}`) };
    assert.equal((await POST(post("not json", owner))).status, 400);
    assert.equal((await POST(post('{"query":7}', owner))).status, 400);
    assert.equal((await POST(post(JSON.stringify({ query: "x", ids: Array(51).fill("a") }), owner))).status, 400);
    assert.equal((await POST(post(JSON.stringify({ query: "x".repeat(20_000) }), owner))).status, 413);
  });
});

test("a deployment without an index answers 503 and leaks no path", async () => {
  await withEnv({ BLACKBOOK_OWNER_PASSWORD: PASSWORD, BLACKBOOK_REPO_ROOT: os.tmpdir(), VERCEL: "1", BLACKBOOK_INDEX_DIR: path.join(os.tmpdir(), "bb-missing-index") }, async () => {
    const { POST } = await import("../app/api/search/route");
    const response = await POST(post('{"query":"x"}', { authorization: basic(`jonathan:${PASSWORD}`) }));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /bb-missing-index|ENOENT/);
  });
});

test("signed image links follow the live eligibility check: downgraded pages get none, an expired check fails closed", async () => {
  let t = Date.parse("2026-11-21T00:00:00.000Z");
  let down = false;
  let rating = "5";
  const withImage = (rating: string) => {
    const item = page("1", "Ada", { rating });
    item.properties.Images = { type: "files", files: [{ name: "a.jpg", type: "file", file: {
      url: "https://example.test/signed", expiry_time: new Date(t + 60 * 60_000).toISOString(),
    } }] };
    return item;
  };
  const checker = createEligibilityChecker(async () => {
    if (down) throw new Error("Notion 500");
    return [withImage(rating)];
  }, () => t);
  const lookup = createBundledMediaLookup(checker, () => t);
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/signed");
  // Downgraded in Notion after the index was built: the next check drops it, no link is signed.
  rating = "3";
  t += 61_000;
  assert.equal(await lookup("1", "a.jpg"), null);
  // Eligible again, then Notion goes down: tolerated within 5 minutes, refused after.
  rating = "5";
  t += 61_000;
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/signed");
  down = true;
  t += 5 * 60_000;
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/signed", "within 5 minutes of the last good check");
  t += 1;
  await assert.rejects(lookup("1", "a.jpg"), EligibilityUnavailableError);
});

test("the eligibility snapshot keeps no private fields from Notion pages", async () => {
  const checker = createEligibilityChecker(async () => [page("1", "Ada")]);
  const [kept] = (await checker()).pages;
  assert.deepEqual(Object.keys(kept.properties).sort(), ["Entry Status", "Images", "Rating"]);
  assert.equal(JSON.stringify(kept).includes("PRIVATE-NOTE"), false);
});
