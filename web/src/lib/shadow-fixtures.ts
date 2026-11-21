import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createShadowFixtures(dir: string, origin: string) {
  if (
    !path.isAbsolute(dir) ||
    !["http:", "https:"].includes(new URL(origin).protocol)
  )
    throw new Error(
      "Use an absolute, empty fixture directory and HTTP origin.",
    );
  await mkdir(dir, { recursive: true });
  if ((await readdir(dir)).length)
    throw new Error("Fixture setup only writes into an empty directory.");
  const revision = Date.now() - 60 * 60 * 1000;
  const names = ["Mina Vale", "Rosa Nakamura", "Other Office", "Sam Ellis"];
  const cases = ["pass", "fail", "legacy", "unsure"];
  const pages = [];
  await mkdir(path.join(dir, "review-feedback"));
  await mkdir(path.join(dir, "manifests"));
  const select = (name: string) => ({ type: "select", select: { name } });
  const rich = (text: string) => ({
    type: "rich_text",
    rich_text: [{ plain_text: text }],
  });
  for (let i = 0; i < names.length; i++) {
    const id = `${i + 1}1111111-1111-4111-8111-111111111111`;
    pages.push({
      id,
      last_edited_time: new Date(revision).toISOString(),
      properties: {
        Name: { type: "title", title: [{ plain_text: names[i] }] },
        "Entry Status": select("Needs Review"),
        Type: select(i === 2 ? "Studio" : "Person"),
        Location: { type: "multi_select", multi_select: [{ name: "London" }] },
        "Work Status": select("Freelance"),
        Capabilities: {
          type: "multi_select",
          multi_select: [{ name: "Graphic design" }],
        },
        "AI Notes": rich(
          "Fictional training fixture. This is original sample artwork, not this person's work.",
        ),
        Notes: rich("A fictional owner note. Never changed by the reviewer."),
        "Open Questions": rich("Would you like more context images?"),
        Rating: select("4"),
        "Work With?": select("Yes"),
        "Worked Together": select("Once"),
        Familiarity: select("Know them well"),
        Website: { type: "url", url: "https://example.com" },
        Images: {
          type: "files",
          files: [
            {
              name: "sample.svg",
              type: "file",
              file: { url: `${new URL(origin).origin}/shadow-sample.svg` },
            },
          ],
        },
      },
    });
    const report = {
      verdict: i === 1 ? "fail" : "pass",
      route: i === 1 ? "bounced" : "ready",
      attempt: 1,
      to: "scraper",
      trust_level: "L0",
      reviewed_revision: revision,
      reviewed_at: new Date().toISOString(),
      live: {
        blocks: 12,
        images: 1,
        h2_work: true,
        checked_at: new Date().toISOString(),
      },
      summary: "Fictional review. The human decides, the reviewer learns.",
      checks: [
        {
          id: "A.context-shots",
          group: "A",
          kind: "read",
          result: i === 1 ? "fail" : i === 3 ? "unsure" : "pass",
          evidence: `See the original sample: ${new URL(origin).origin}/shadow-sample.svg`,
          ...(i === 1
            ? { fix: "Add an actual portfolio context screenshot." }
            : {}),
        },
        {
          id: "B.type",
          group: "B",
          kind: "rule",
          result: "pass",
          evidence: "The profile type is recorded.",
        },
        {
          id: "C.no-contradiction",
          group: "C",
          kind: "read",
          result: "pass",
          evidence: "The owner's judgment fields are displayed, not changed.",
        },
        {
          id: "D.source",
          group: "D",
          kind: "rule",
          result: "pass",
          evidence: "This is a labeled fictional fixture.",
        },
      ],
    };
    if (cases[i] === "legacy") {
      Reflect.deleteProperty(report, "live");
      Reflect.deleteProperty(report, "reviewed_revision");
    }
    await writeFile(
      path.join(dir, "review-feedback", `${id}.json`),
      JSON.stringify(report, null, 2),
    );
    await writeFile(
      path.join(dir, "manifests", `${id}.json`),
      JSON.stringify([
        {
          file: "sample.svg",
          caption: "Tide. Original fictional specimen.",
          link: "https://example.com",
        },
      ]),
    );
  }
  await writeFile(path.join(dir, "pages.json"), JSON.stringify(pages, null, 2));
  return pages;
}
