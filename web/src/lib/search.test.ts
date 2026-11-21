import assert from "node:assert/strict";
import test from "node:test";
import { profiles } from "./fixtures";
import { emptyFilters, interpretBrief, searchProfiles } from "./search";
import {
  CAPABILITIES,
  PROFILE_TYPES,
  WORK_STATUSES,
  type Profile,
} from "./types";

const mina = profiles.find((profile) => profile.id === "mina")!;
const search = (query: string) => searchProfiles(profiles, query, emptyFilters);
const make = (id: string, fields: Partial<Profile> = {}): Profile => ({
  ...mina,
  id,
  ...fields,
});

test("the contract represents all 26 alphabetical capability values and real types/statuses", () => {
  assert.equal(CAPABILITIES.length, 26);
  assert.deepEqual([...CAPABILITIES], [...CAPABILITIES].sort());
  assert.deepEqual(PROFILE_TYPES, [
    "Agency",
    "Foundry",
    "Person",
    "Publication",
    "Studio",
  ]);
  assert.ok(WORK_STATUSES.includes("Employed"));
});

test("B01: type-led food packaging matches recorded work rather than requiring exact prose", () => {
  const result = search(
    "Find freelance designers for type-led food packaging",
  ).find((result) => result.profile.id === "mina");
  assert.ok(result);
  assert.equal(result.tier, "strong");
  assert.deepEqual(result.matchedTerms, ["type", "food", "packaging"]);
});

test("project descriptions are searchable: olive oil finds Mina", () => {
  const result = search("olive oil").find(
    (result) => result.profile.id === "mina",
  );
  assert.ok(result);
  assert.equal(result.tier, "strong");
  assert.deepEqual(result.matchedTerms, ["olive", "oil"]);
});

test("project titles alone can ground a result", () => {
  const isolated = make("title-only", {
    name: "Demo",
    role: "Designer",
    capabilities: [],
    evidence: [],
    keywords: [],
    projects: [{ ...mina.projects[0], title: "Aperture", description: "" }],
  });
  const [result] = searchProfiles([isolated], "aperture", emptyFilters);
  assert.equal(result.tier, "strong");
  assert.match(result.reason!, /^Project: Aperture/);
});

test("partial results retain and explain missing keywords", () => {
  const result = search("olive oil spaceship").find(
    (result) => result.profile.id === "mina",
  );
  assert.ok(result);
  assert.equal(result.tier, "weak");
  assert.deepEqual(result.missingTerms, ["spaceship"]);
  assert.equal(result.score, 2);
});

test("gibberish has no unrelated fallback results", () => {
  assert.deepEqual(search("zxqwvbzz"), []);
});

test("browsing and hard-filter-only queries do not invent match reasons", () => {
  assert.ok(search("").length > 0);
  assert.ok(search("").every((result) => result.reason === null));
  assert.ok(
    search("freelance").every(
      (result) =>
        result.reason === null && result.profile.workStatus === "Freelance",
    ),
  );
});

test("a role match cites that role, never the first unrelated portfolio line", () => {
  const isolated = make("role-only", {
    role: "Robotics designer",
    evidence: ["Unrelated painting project."],
    projects: [],
    capabilities: [],
    keywords: ["ballet"],
  });
  const [result] = searchProfiles([isolated], "robotics", emptyFilters);
  assert.equal(result.reason, "Role · Robotics designer");
  assert.deepEqual(searchProfiles([isolated], "ballet", emptyFilters), []);
});

test("Needs Review is excluded by default and only explicitly opt-in", () => {
  assert.ok(search("").every((result) => result.profile.status === "Verified"));
  const results = searchProfiles(profiles, "", {
    ...emptyFilters,
    includeNeedsReview: true,
  });
  assert.ok(results.some((result) => result.profile.status === "Needs Review"));
});

test("Rejected and other in-progress statuses never enter results, even with opt-in", () => {
  const statuses = ["Rejected", "New", "Enriching", "Revisit"] as const;
  assert.deepEqual(
    searchProfiles(
      statuses.map((status) => make(status, { status })),
      "",
      { ...emptyFilters, includeNeedsReview: true },
    ),
    [],
  );
});

test("weak matches never relax explicit work status, type, or capability filters", () => {
  const results = searchProfiles(profiles, "packaging spaceship", {
    ...emptyFilters,
    workStatus: "Freelance",
    type: "Person",
    capability: "Graphic design",
    includeNeedsReview: true,
  });
  assert.ok(results.length > 0);
  assert.ok(
    results.every(
      (result) =>
        result.profile.workStatus === "Freelance" &&
        result.profile.type === "Person" &&
        result.profile.capabilities.includes("Graphic design"),
    ),
  );
});

test("B03: an employed person cannot fill a freelance request, including weak matches", () => {
  const employed = make("employed", { workStatus: "Employed" });
  assert.deepEqual(
    searchProfiles([employed], "freelance packaging", emptyFilters),
    [],
  );
  assert.equal(
    searchProfiles([employed], "packaging", {
      ...emptyFilters,
      workStatus: "Employed",
    }).length,
    1,
  );
});

test("B15: foundry intent is explicit and removable", () => {
  const foundry = make("foundry", { type: "Foundry" });
  const options = [mina, foundry];
  assert.deepEqual(interpretBrief("type foundries").types, ["Foundry"]);
  assert.deepEqual(
    searchProfiles(options, "type foundries", emptyFilters).map(
      (result) => result.profile.id,
    ),
    ["foundry"],
  );
  assert.equal(
    searchProfiles(options, "type foundries", emptyFilters, ["type:Foundry"])
      .length,
    2,
  );
});

test("Agency and Publication types can be filtered without coercing them to studios", () => {
  for (const type of ["Agency", "Publication"] as const) {
    assert.equal(
      searchProfiles([make(type, { type }), mina], "", {
        ...emptyFilters,
        type,
      }).length,
      1,
    );
  }
});

test("removing an interpretation chip removes exactly that constraint", () => {
  assert.deepEqual(search("spaceship"), []);
  assert.ok(
    searchProfiles(profiles, "spaceship", emptyFilters, ["spaceship"]).length >
      0,
  );
  const options = [mina, make("employed", { workStatus: "Employed" })];
  assert.equal(
    searchProfiles(options, "freelance packaging", emptyFilters).length,
    1,
  );
  assert.equal(
    searchProfiles(options, "freelance packaging", emptyFilters, ["freelance"])
      .length,
    2,
  );
});

test("exact verified matches precede weak matches and optional unverified drafts", () => {
  const results = searchProfiles(
    [
      make("draft", { status: "Needs Review" }),
      make("weak", {
        evidence: [],
        projects: [],
        capabilities: [],
        role: "Food designer",
      }),
      mina,
    ],
    "food packaging",
    { ...emptyFilters, includeNeedsReview: true },
  );
  assert.deepEqual(
    results.map((result) => result.profile.id),
    ["mina", "weak", "draft"],
  );
});

test("known owner preference, rating and repeat work break otherwise equal matches", () => {
  const options = [
    make("no", { workWith: "No", rating: 5 }),
    make("lower", { workWith: "Yes", rating: 3 }),
    make("trial", { workWith: "Yes", rating: 5, workedTogether: "Never" }),
    make("known", { workWith: "Yes", rating: 5, workedTogether: "Repeatedly" }),
  ];
  assert.deepEqual(
    searchProfiles(options, "packaging", emptyFilters).map(
      (result) => result.profile.id,
    ),
    ["known", "trial", "lower", "no"],
  );
});

test("search never mutates fixtures or fabricates missing owner judgments", () => {
  const before = JSON.stringify(profiles);
  search("packaging");
  assert.equal(JSON.stringify(profiles), before);
  assert.equal(mina.rating, undefined);
});

test("normalized accents and word boundaries avoid substring-only matches", () => {
  assert.ok(search("ines").some((result) => result.profile.id === "ines"));
  assert.deepEqual(
    searchProfiles(
      [
        make("substring", {
          name: "Demo",
          role: "Building",
          capabilities: [],
          evidence: [],
          projects: [],
          keywords: [],
        }),
      ],
      "ui",
      emptyFilters,
    ),
    [],
  );
});

test("unaccented full names, misspelled surnames and exact project titles are discoverable", () => {
  assert.equal(search("Ines Laurent")[0].profile.id, "ines");
  const [typo] = search("Nakamrua");
  assert.equal(typo.profile.id, "leo");
  assert.equal(typo.tier, "weak");
  assert.match(typo.reason!, /Name \(close spelling\).*Leo Nakamura/);
  assert.equal(search("Common Ground")[0].profile.id, "mina");
});

test("name matches beat incidental project mentions at the same match strength", () => {
  assert.equal(search("Other")[0].profile.id, "other");
  assert.equal(search("Other Office")[0].profile.id, "other");
});
