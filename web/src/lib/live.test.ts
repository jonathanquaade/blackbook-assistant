import assert from "node:assert/strict";
import test from "node:test";
import { parseLiveBrief, reciprocalRankFusion, toTsQuery } from "./live/brief";
import { EMBEDDING_MODEL } from "./live/model";
import { embeddingInputs, mergeDuplicates, projectPage, readEligibility, type NotionPage } from "./live/projection";
import { searchIndex } from "./live/search";
import { createDb, writeEntries, writeVectors } from "./live/store";

const rich = (value: string) => [{ plain_text: value }];
function page(id: string, name: string, extra: { status?: string; rating?: string | null; capabilities?: string[]; work?: string; notes?: string; images?: string[] } = {}): NotionPage {
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
      Country: { type: "multi_select", multi_select: [{ name: "Germany" }] },
      Notes: { type: "rich_text", rich_text: rich(extra.notes ?? "PRIVATE NOTE day rate 900") },
      Email: { type: "email", email: "private@example.com" },
      Images: { type: "files", files: (extra.images ?? ["a.jpg"]).map((file) => ({ name: file, type: "file" })) },
    },
  };
}

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
  assert.equal(toTsQuery(["type", "a", "o'neil"]), "type:* | oneil:*");
  assert.equal(toTsQuery([]), null);
  const scores = reciprocalRankFusion([["a", "b"], ["b"]]);
  assert.ok(scores.get("b")! > scores.get("a")!);
});

test("search never returns ineligible rows and applies explicit filters", async () => {
  const db = await createDb();
  const entries = [
    projectPage(page("1", "Ada", { capabilities: ["Type design"] }), [{ file: "a.jpg", caption: "Bakery packaging type" }]),
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
  await db.close();
});
