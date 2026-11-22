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
const locationNames = new Map(locationsByName.flatMap(([name, aliases]) => aliases.map((alias) => [alias, name] as const)));
const locationPrefix = new RegExp("^\\s*(?:the\\s+)?(" +
  [...locationNames.keys()].sort((a, b) => b.length - a.length).join("|") + ")(?=$|[\\s,])");
const locationSeparator = /^(?:\s*,\s*(?:(?:and|or)\s+)?|\s+(?:and|or)\s+)/;
const briefQualifier = /^\s+(?:with|without|who|that|for|working|speciali[sz]ing)\b/;

export function canonicalLocation(location: string) {
  const value = location.trim().toLowerCase();
  return locationNames.get(value) ?? location.trim();
}

export interface LiveBrief {
  freelance: boolean;
  types: string[];
  locations: string[];
  terms: string[];
}

export function parseLiveBrief(query: string, muted: string[] = []): LiveBrief {
  const intent = interpretBrief(query);
  const lower = query.toLowerCase().replace(/[^\p{L}\p{N}\s,]/gu, " ").replace(/\s+/g, " ");
  const locationWords = new Set<string>();
  const locations = new Set<string>();
  const addLocation = (alias: string) => {
    const name = canonicalLocation(alias);
    if (!muted.includes("location:" + name)) locations.add(name);
    alias.split(" ").forEach((word) => locationWords.add(word));
  };
  for (const phrase of lower.matchAll(/\b(?:in|from|near|around|across)\s+/g)) {
    let rest = lower.slice(phrase.index + phrase[0].length);
    let afterBareComma = false;
    for (let match; (match = locationPrefix.exec(rest));) {
      rest = rest.slice(match[0].length);
      const alias = match[1];
      const separator = locationSeparator.exec(rest);
      if (alias === "porto" && /^\s+rocha\b/.test(rest)) break;
      if (afterBareComma && alias.length <= 2 && rest.trim() && !separator && !briefQualifier.test(rest)) break;
      addLocation(alias);
      if (!separator) break;
      afterBareComma = separator[0].trim() === ",";
      rest = rest.slice(separator[0].length);
    }
  }
  const words = " " + lower.replace(/,\s*/g, " ") + " ";
  for (const alias of locationNames.keys()) {
    if (alias.length > 2 && alias !== "porto" && words.includes(" " + alias + " ")) addLocation(alias);
  }
  return {
    freelance: intent.freelance && !muted.includes("freelance"),
    types: intent.types.filter((type) => !muted.includes(`type:${type}`)),
    locations: [...locations],
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
