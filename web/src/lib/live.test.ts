import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { allowsOwnerTransport, isOwner } from "./live/auth";
import { parseLiveBrief, reciprocalRankFusion, toTsQuery } from "./live/brief";
import { liveSetting } from "./live/config";
import { createMediaLookup } from "./live/media";
import { EMBEDDING_MODEL } from "./live/model";
import { hasSelectedWork } from "./live/project-work";
import { embeddingInputs, mergeDuplicates, projectPage, readEligibility, type NotionPage } from "./live/projection";
import { searchIndex } from "./live/search";
import { createDb, writeEntries, writeVectors } from "./live/store";

const rich = (value: string) => [{ plain_text: value }];
function page(id: string, name: string, extra: { status?: string; rating?: string | null; capabilities?: string[]; work?: string; notes?: string; images?: string[]; country?: string } = {}): NotionPage {
  return {
    id,
    last_edited_time: "2026-11-01T00:00:00.000Z",
    properties: {
      Name: { type: "title", title: rich(name) },
      "Entry Status": { type: "select", select: { name: extra.status ?? "Verified" } },
      Rating: { type: "select", select: extra.rating === null ? null : { name: extra.rating ?? "5" } },
      Type: { type: "select", select: { name: "Person" } },
      Capabilities: { type: "multi_select", multi_select: (extra.capabilities ?? ["Type design"]).map((item) => ({ name: item })) },
      "Work Status": { type: "select", select: { name: extra.work ?? "Freelance" } },
      Country: { type: "multi_select", multi_select: [{ name: extra.country ?? "Germany" }] },
      Notes: { type: "rich_text", rich_text: rich(extra.notes ?? "PRIVATE NOTE day rate 900") },
      Email: { type: "email", email: "private@example.com" },
      Images: { type: "files", files: (extra.images ?? ["a.jpg"]).map((file) => ({ name: file, type: "file" })) },
    },
  };
}

test("live configuration falls back to root .env, with exported overrides", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "blackbook-settings-"));
  const original = process.env.BLACKBOOK_REPO_ROOT;
  const setting = "BLACKBOOK_TEST_CONFIG_VALUE";
  process.env.BLACKBOOK_REPO_ROOT = root;
  t.after(() => {
    if (original === undefined) delete process.env.BLACKBOOK_REPO_ROOT;
    else process.env.BLACKBOOK_REPO_ROOT = original;
    delete process.env[setting];
    rmSync(root, { recursive: true, force: true });
  });
  writeFileSync(path.join(root, ".env"), `${setting}="file value"\n`);
  assert.equal(liveSetting(setting), "file value");
  process.env[setting] = "exported value";
  assert.equal(liveSetting(setting), "exported value");
});

test("only the configured owner credential grants live access", () => {
  const basic = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;
  assert.equal(isOwner(null, "demo"), false);
  assert.equal(isOwner(basic("visitor:demo"), "demo"), false);
  assert.equal(isOwner(basic("jonathan:other"), "demo"), false);
  assert.equal(isOwner(basic("jonathan:demo"), "demo"), true);
});

test("owner access requires HTTPS unless explicitly testing on loopback", () => {
  const request = (host: string, proto: string) => new Headers({ host, "x-forwarded-proto": proto });
  assert.equal(allowsOwnerTransport(request("blackbook.example", "https"), false), true);
  assert.equal(allowsOwnerTransport(request("blackbook.example", "https,http"), false), false);
  assert.equal(allowsOwnerTransport(request("blackbook.example", "http"), true), false);
  assert.equal(allowsOwnerTransport(request("127.0.0.1:3000", "http"), false), false);
  assert.equal(allowsOwnerTransport(request("127.0.0.1:3000", "http"), true), true);
  const proxied = request("127.0.0.1:3000", "http");
  proxied.set("x-forwarded-host", "blackbook.example");
  assert.equal(allowsOwnerTransport(proxied, true), false);
});

test("media rechecks eligibility after a sync and never serves an expired cache", async () => {
  let now = Date.parse("2026-11-21T00:00:00.000Z");
  let generation = "first";
  const item = page("1", "Ada");
  item.properties.Images.files = [{ type: "file", name: "a.jpg", file: {
    url: "https://example.test/image",
    expiry_time: new Date(now + 60 * 60_000).toISOString(),
  } }];
  let pages = [item];
  let reads = 0;
  const lookup = createMediaLookup(async () => { reads++; return pages; }, () => generation, () => now);
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/image");
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/image");
  assert.equal(reads, 1);
  pages = [{ ...item, properties: { ...item.properties, Rating: { type: "select", select: { name: "3" } } } }];
  generation = "second";
  assert.equal(await lookup("1", "a.jpg"), null);
  pages = [item];
  now += 60_000;
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/image");
  assert.equal(reads, 3);
});

test("an image requested during a snapshot swap is rechecked against the new generation", async () => {
  let generation = "first";
  const item = page("1", "Ada");
  item.properties.Images.files = [{ type: "file", name: "a.jpg", file: {
    url: "https://example.test/image", expiry_time: "2026-11-22T00:00:00Z",
  } }];
  let reads = 0;
  const lookup = createMediaLookup(async () => {
    if (++reads === 1) generation = "second";
    return [item];
  }, () => generation, () => Date.parse("2026-11-21T00:00:00Z"));
  assert.equal(await lookup("1", "a.jpg"), "https://example.test/image");
  assert.equal(reads, 2);
});

test("only Verified entries rated 4 or 5 are eligible", () => {
  assert.equal(readEligibility(page("1", "A")).eligible, true);
  assert.equal(readEligibility(page("1", "A", { rating: "4" })).eligible, true);
  assert.equal(readEligibility(page("1", "A", { rating: "3" })).eligible, false);
  assert.equal(readEligibility(page("1", "A", { rating: null })).eligible, false);
  assert.equal(readEligibility(page("1", "A", { status: "Needs Review" })).eligible, false);
  assert.equal(readEligibility({ ...page("1", "A"), in_trash: true }).eligible, false);
});

test("embedding text holds names, roles and project captions, never notes or contacts", () => {
  const entry = projectPage(page("1", "Ada Type"), [{ file: "a.jpg", caption: "Grotesk specimen for a bakery" }]);
  const text = embeddingInputs(entry).map((input) => input.text).join("\n");
  assert.match(text, /Ada Type/);
  assert.match(text, /Grotesk specimen/);
  assert.doesNotMatch(text, /PRIVATE|900|example\.com/);
  assert.ok(embeddingInputs(entry).every((input) => input.hash.length === 64));
});

test("manifest images removed from Notion are not shown", () => {
  const entry = projectPage(page("1", "Ada", { images: ["b.jpg"] }), [
    { file: "a.jpg", caption: "Old" },
    { file: "b.jpg", caption: "Current" },
  ]);
  assert.deepEqual(entry.projects.map((project) => project.caption), ["Current"]);
});

test("work links, distinct media destinations and per-image sources are preserved", () => {
  const entry = projectPage(page("1", "Ada", { images: ["a.jpg", "b.jpg", "removed.jpg"] }), [
    { type: "embed", caption: "Sound work", link: "https://example.test/sound", url: "https://vimeo.com/123" },
    { type: "embed", caption: "Sound work", link: "https://example.test/sound", url: "https://vimeo.com/456" },
    { type: "embed", caption: "Video only", url: "https://vimeo.com/789" },
    { type: "bookmark", caption: "Case study", url: "https://example.test/video" },
    { file: "a.jpg", caption: "Print work", link: "https://example.test/a" },
    { file: "b.jpg", caption: "Print work", link: "https://example.test/b" },
    { file: "removed.jpg", caption: "Removed", rejected: true },
  ]);
  assert.deepEqual(entry.projects.filter(hasSelectedWork).map((project) => [project.caption, project.link, project.media, project.images.map((image) => image.source)]), [
    ["Sound work", "https://example.test/sound", ["https://vimeo.com/123", "https://vimeo.com/456"], []],
    ["Video only", null, ["https://vimeo.com/789"], []],
    ["Case study", "https://example.test/video", [], []],
    ["Print work", "https://example.test/a", [], ["https://example.test/a", "https://example.test/b"]],
  ]);
});

test("duplicate pages for one person merge into one result", () => {
  const merged = mergeDuplicates([projectPage(page("1", "Ada Lovelace"), []), projectPage(page("2", "Ada  Lovelace"), [])]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].pageIds.sort(), ["1", "2"]);
});

test("brief parsing, tsquery and fusion", () => {
  const brief = parseLiveBrief("Freelance type designers in Berlin");
  assert.equal(brief.freelance, true);
  assert.deepEqual(brief.locations, ["Germany"]);
  assert.ok(!brief.terms.includes("berlin"));
  const studio = parseLiveBrief("Senior ex-COLLINS or Porto Rocha level identity designer");
  assert.deepEqual(studio.locations, []);
  assert.ok(studio.terms.includes("porto"));
  assert.deepEqual(parseLiveBrief("Designers based in Porto").locations, ["Portugal"]);
  assert.deepEqual(parseLiveBrief("Work inspired by designers from Porto Rocha").locations, []);
  assert.deepEqual(parseLiveBrief("Identity designers from Porto-Rocha-style studios").locations, []);
  assert.deepEqual(parseLiveBrief("Identity designers from Porto‑Rocha-style studios").locations, []);
  assert.deepEqual(parseLiveBrief("Identity designers from Porto-based studios").locations, ["Portugal"]);
  assert.deepEqual(parseLiveBrief("Designers in the UK or US").locations, ["United Kingdom", "United States"]);
  assert.deepEqual(parseLiveBrief("Packaging designers in the UK\u2014or the US").locations, ["United Kingdom", "United States"]);
  assert.deepEqual(parseLiveBrief("Designers in Japan, the UK, and LA").locations, ["Japan", "United Kingdom", "United States"]);
  assert.deepEqual(parseLiveBrief("Designers in Berlin, US").locations, ["Germany", "United States"]);
  assert.deepEqual(parseLiveBrief("Designers in Berlin, the UK with packaging experience").locations, ["Germany", "United Kingdom"]);
  assert.deepEqual(parseLiveBrief("Designers in Berlin, UK\u2014with packaging experience").locations, ["Germany", "United Kingdom"]);
  assert.deepEqual(parseLiveBrief("Designers in Berlin, UK who do packaging").locations, ["Germany", "United Kingdom"]);
  assert.deepEqual(parseLiveBrief("Designers in Berlin, UK working in packaging").locations, ["Germany", "United Kingdom"]);
  for (const qualifier of ["for a packaging project", "working remotely", "specializing primarily in packaging"]) {
    assert.deepEqual(parseLiveBrief(`Designers in Berlin, UK ${qualifier}`).locations, ["Germany", "United Kingdom"], qualifier);
  }
  const clientMarket = parseLiveBrief("Identity designers in Berlin, US client experience preferred");
  assert.deepEqual(clientMarket.locations, ["Germany"]);
  assert.ok(clientMarket.terms.includes("client"));
  assert.deepEqual(parseLiveBrief("Designers in Berlin, the US client prefers packaging experience").locations, ["Germany"]);
  for (const modifier of ["for-profit", "for‑profit"]) {
    assert.deepEqual(parseLiveBrief(`Brand designers in Berlin, US ${modifier} client experience preferred`).locations, ["Germany"], modifier);
  }
  assert.deepEqual(parseLiveBrief("Designers in UK-based studios").locations, ["United Kingdom"]);
  const workingHours = parseLiveBrief("Packaging designers in Berlin, US working hours required");
  assert.deepEqual(workingHours.locations, ["Germany"]);
  assert.ok(workingHours.terms.includes("us"));
  assert.deepEqual(parseLiveBrief("Designers near Porto and GB", ["location:Portugal"]).locations, ["United Kingdom"]);
  assert.deepEqual(parseLiveBrief("Show us packaging designers").locations, []);
  assert.equal(toTsQuery(["type", "a", "o'neil"]), "type:* | oneil:*");
  assert.equal(toTsQuery([]), null);
  const scores = reciprocalRankFusion([["a", "b"], ["b"]]);
  assert.ok(scores.get("b")! > scores.get("a")!);
});

test("search never returns ineligible rows and applies explicit filters", async () => {
  const db = await createDb();
  const entries = [
    projectPage(page("1", "Ada", { capabilities: ["Type design"], country: "UK" }), [{ file: "a.jpg", caption: "Bakery packaging type" }]),
    projectPage(page("2", "Ben", { capabilities: ["Photography"], work: "Employed" }), [{ file: "a.jpg", caption: "Fashion campaign" }]),
    { ...projectPage(page("3", "Cy", { capabilities: ["Type design"] }), [{ file: "a.jpg", caption: "Bakery packaging type" }]), rating: 3 },
  ];
  await writeEntries(db, entries);
  const unit = (index: number) => Array.from({ length: EMBEDDING_MODEL.dims }, (_, i) => (i === index ? 1 : 0));
  await writeVectors(db, [
    { entryId: "1", projectIdx: null, hash: "h1", embedding: unit(0) },
    { entryId: "2", projectIdx: null, hash: "h2", embedding: unit(1) },
    { entryId: "3", projectIdx: null, hash: "h3", embedding: unit(0) },
  ]);
  const hybrid = await searchIndex(db, { query: "packaging type", queryVector: unit(0) });
  assert.deepEqual(hybrid.results.map((result) => result.name), ["Ada"]);
  assert.equal(hybrid.results[0].tier, "strong");
  assert.match(hybrid.results[0].reason ?? "", /Bakery packaging type/);
  const freelance = await searchIndex(db, { query: "freelance fashion campaign" });
  assert.deepEqual(freelance.results.map((result) => result.name), []);
  const browse = await searchIndex(db, { query: "" });
  assert.deepEqual(browse.results.map((result) => result.name).sort(), ["Ada", "Ben"]);
  const japan = await searchIndex(db, { query: "Freelance Arabic type designer based in Japan" });
  assert.deepEqual(japan.results, []);
  assert.deepEqual(japan.brief.locations, ["Japan"]);
  const uk = await searchIndex(db, { query: "Type designer in the UK" });
  assert.deepEqual(uk.results.map((result) => result.name), ["Ada"]);
  const germany = await searchIndex(db, { query: "Type designer in Berlin" });
  assert.deepEqual(germany.results, []);
  await db.close();
});
