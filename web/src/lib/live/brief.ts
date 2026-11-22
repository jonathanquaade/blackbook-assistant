import { interpretBrief } from "../search";

const LOCATION_ALIASES: Record<string, string[]> = {
  "United Kingdom": ["uk", "gb", "united kingdom", "britain", "british", "england", "london", "scotland"],
  "United States": ["us", "usa", "united states", "america", "american", "new york", "nyc", "los angeles", "la"],
  France: ["france", "french", "paris"],
  Germany: ["germany", "german", "berlin"],
  Spain: ["spain", "spanish", "madrid", "barcelona"],
  Portugal: ["portugal", "portuguese", "lisbon", "porto"],
  Netherlands: ["netherlands", "dutch", "amsterdam", "holland"],
  Austria: ["austria", "austrian", "vienna"],
  Poland: ["poland", "polish", "warsaw"],
  "South Korea": ["south korea", "korea", "korean", "seoul"],
  Russia: ["russia", "russian", "moscow"],
  Japan: ["japan", "tokyo", "osaka"],
  "United Arab Emirates": ["united arab emirates", "uae", "dubai", "abu dhabi"],
};

const SOURCE_COUNTRIES = [
  "Argentina", "Armenia", "Australia", "Belgium", "Bosnia and Herzegovina", "Brazil",
  "Canada", "China", "Colombia", "Costa Rica", "Czech Republic", "Denmark", "Estonia",
  "Finland", "Ghana", "Greece", "Hong Kong", "Hungary", "Iceland", "India", "Ireland",
  "Israel", "Italy", "Kenya", "Malaysia", "Mexico", "New Zealand", "Nigeria", "Norway",
  "Pakistan", "Qatar", "Singapore", "Slovakia", "Slovenia", "South Africa", "Sweden",
  "Switzerland", "Taiwan", "Uganda", "Ukraine", "Uruguay", "Vietnam",
];
const locationsByName = [
  ...Object.entries(LOCATION_ALIASES),
  ...SOURCE_COUNTRIES.map((name): [string, string[]] => [name, [name.toLowerCase()]]),
];
const contextualAliases = new Set(["porto"]);

export function canonicalLocation(location: string) {
  const value = location.trim().toLowerCase();
  const match = locationsByName.find(
    ([name, aliases]) => name.toLowerCase() === value || aliases.includes(value),
  );
  return match ? match[0] : location.trim();
}

export interface LiveBrief {
  freelance: boolean;
  types: string[];
  locations: string[];
  terms: string[];
}

export function parseLiveBrief(query: string, muted: string[] = []): LiveBrief {
  const intent = interpretBrief(query);
  const lower = ` ${query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ")} `;
  const locationWords = new Set<string>();
  const locations = locationsByName
    .filter(([, aliases]) =>
      aliases.some((alias) => {
        const hit = alias.length <= 2 || contextualAliases.has(alias)
          ? new RegExp(` (?:in|from|near|around|across) (?:the )?${alias} `).test(lower)
          : lower.includes(` ${alias} `);
        if (hit) alias.split(" ").forEach((word) => locationWords.add(word));
        return hit;
      }),
    )
    .map(([name]) => name)
    .filter((name) => !muted.includes(`location:${name}`));
  return {
    freelance: intent.freelance && !muted.includes("freelance"),
    types: intent.types.filter((type) => !muted.includes(`type:${type}`)),
    locations,
    terms: intent.terms.filter(
      (term) => !locationWords.has(term) && !muted.includes(term),
    ),
  };
}

/** Postgres to_tsquery input: OR of prefix matches, restricted to safe characters. */
export function toTsQuery(terms: string[]) {
  const safe = [
    ...new Set(
      terms
        .map((term) => term.normalize("NFKD").replace(/[^a-z0-9]/gi, "").toLowerCase())
        .filter((term) => term.length > 1),
    ),
  ];
  return safe.length ? safe.map((term) => `${term}:*`).join(" | ") : null;
}

/** Reciprocal-rank fusion over ranked id lists. */
export function reciprocalRankFusion(lists: string[][], k = 60) {
  const scores = new Map<string, number>();
  for (const list of lists)
    list.forEach((id, rank) =>
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)),
    );
  return scores;
}
