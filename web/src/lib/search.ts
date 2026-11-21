import type { Capability, Profile } from "./types";

export interface Filters {
  capability: Capability | "All";
  workStatus: "All" | Profile["workStatus"];
  type: "All" | Profile["type"];
  includeNeedsReview: boolean;
}
export const emptyFilters: Filters = {
  capability: "All",
  workStatus: "All",
  type: "All",
  includeNeedsReview: false,
};
const stopWords = new Set(
  "a an and are at best brief by can creative creatives design designer designers do find for great i in is led looking me my need of on or people person please project projects show some someone talented that the their to want who with work working you".split(
    " ",
  ),
);
const aliases: Record<string, string> = {
  typography: "type",
  typographic: "type",
  branding: "brand",
  identities: "identity",
  interfaces: "interface",
  websites: "web",
  website: "web",
  applications: "app",
  apps: "app",
  products: "product",
  animated: "motion",
  animation: "motion",
  photographer: "photography",
  photographers: "photography",
  editorial: "editorial",
};

function words(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
const typeWords: Record<string, Profile["type"]> = {
  studio: "Studio",
  studios: "Studio",
  agency: "Agency",
  agencies: "Agency",
  foundry: "Foundry",
  foundries: "Foundry",
  publication: "Publication",
  publications: "Publication",
};

export function interpretBrief(query: string) {
  const tokens = words(query);
  const types = [
    ...new Set(tokens.map((word) => typeWords[word]).filter(Boolean)),
  ];
  return {
    types,
    freelance:
      tokens.includes("freelance") ||
      tokens.includes("freelancer") ||
      tokens.includes("freelancers"),
    terms: [
      ...new Set(
        tokens
          .filter(
            (word) =>
              !stopWords.has(word) &&
              !typeWords[word] &&
              !["freelance", "freelancer", "freelancers"].includes(word),
          )
          .map((word) => aliases[word] ?? word),
      ),
    ],
  };
}

function matchesTerm(text: string, term: string) {
  return words(text).some((word) => {
    const canonical = aliases[word] ?? word;
    return (
      canonical === term || (term.length >= 4 && canonical.startsWith(term))
    );
  });
}

function closeSpelling(left: string, right: string) {
  if (
    Math.min(left.length, right.length) < 5 ||
    Math.abs(left.length - right.length) > 1
  )
    return false;
  if (left.length === right.length) {
    const differences = [...left].flatMap((letter, index) =>
      letter === right[index] ? [] : [index],
    );
    if (differences.length === 1) return true;
    const [first, second] = differences;
    return (
      differences.length === 2 &&
      second === first + 1 &&
      left[first] === right[second] &&
      left[second] === right[first]
    );
  }
  const [longer, shorter] =
    left.length > right.length ? [left, right] : [right, left];
  const index = [...shorter].findIndex(
    (letter, index) => letter !== longer[index],
  );
  return index === -1 || longer.slice(index + 1) === shorter.slice(index);
}

export interface SearchResult {
  profile: Profile;
  score: number;
  tier: "strong" | "weak";
  matchedTerms: string[];
  missingTerms: string[];
  reason: string | null;
}

function ownerPreference(profile: Profile) {
  const workWith = profile.workWith ?? "Unvetted";
  return { Definitely: 4, Yes: 3, Unvetted: 2, "In a pinch": 1, No: 0 }[
    workWith
  ];
}

export function searchProfiles(
  profiles: Profile[],
  query: string,
  filters: Filters,
  muted: string[] = [],
): SearchResult[] {
  const intent = interpretBrief(query);
  const terms = intent.terms.filter((term) => !muted.includes(term));
  const freelance = intent.freelance && !muted.includes("freelance");
  const types = intent.types.filter((type) => !muted.includes(`type:${type}`));
  return profiles
    .filter(
      (profile) =>
        profile.status === "Verified" ||
        (filters.includeNeedsReview && profile.status === "Needs Review"),
    )
    .filter((profile) => !freelance || profile.workStatus === "Freelance")
    .filter((profile) => types.length === 0 || types.includes(profile.type))
    .filter(
      (profile) =>
        filters.workStatus === "All" ||
        profile.workStatus === filters.workStatus,
    )
    .filter(
      (profile) => filters.type === "All" || profile.type === filters.type,
    )
    .filter(
      (profile) =>
        filters.capability === "All" ||
        profile.capabilities.includes(filters.capability),
    )
    .map((profile) => {
      const sources = [
        ...profile.evidence.map((text) => ({
          label: "Portfolio evidence",
          text,
        })),
        ...profile.projects.map((project) => ({
          label: `Project: ${project.title}`,
          text: `${project.title}. ${project.description}`,
        })),
        { label: "Name", text: profile.name },
        { label: "Role", text: profile.role },
        { label: "Location", text: profile.location },
        { label: "Capabilities", text: profile.capabilities.join(", ") },
      ];
      const exact = terms.filter((term) =>
        sources.some((source) => matchesTerm(source.text, term)),
      );
      const fuzzy = terms.filter(
        (term) =>
          !exact.includes(term) &&
          words(profile.name).some((word) => closeSpelling(word, term)),
      );
      const matches = [...exact, ...fuzzy];
      const source = sources.find((source) =>
        exact.some((term) => matchesTerm(source.text, term)),
      );
      return {
        profile,
        score: matches.length,
        nameScore: exact.filter((term) => matchesTerm(profile.name, term))
          .length,
        tier:
          matches.length === terms.length && fuzzy.length === 0
            ? ("strong" as const)
            : ("weak" as const),
        matchedTerms: matches,
        missingTerms: terms.filter((term) => !matches.includes(term)),
        reason: fuzzy.length
          ? `Name (close spelling) · ${profile.name}`
          : source
            ? `${source.label} · ${source.text}`
            : null,
      };
    })
    .filter((result) => terms.length === 0 || result.score > 0)
    .sort(
      (a, b) =>
        Number(b.profile.status === "Verified") -
          Number(a.profile.status === "Verified") ||
        Number(b.tier === "strong") - Number(a.tier === "strong") ||
        b.score - a.score ||
        b.nameScore - a.nameScore ||
        ownerPreference(b.profile) - ownerPreference(a.profile) ||
        (b.profile.rating ?? 0) - (a.profile.rating ?? 0) ||
        Number(b.profile.workedTogether === "Repeatedly") -
          Number(a.profile.workedTogether === "Repeatedly") ||
        a.profile.name.localeCompare(b.profile.name),
    );
}
