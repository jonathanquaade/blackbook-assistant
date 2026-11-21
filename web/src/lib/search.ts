import type { Capability, Profile } from "./types";

export interface Filters {
  capability: Capability | "All";
  workStatus: "All" | Profile["workStatus"];
  type: "All" | Profile["type"];
}
export const emptyFilters: Filters = {
  capability: "All",
  workStatus: "All",
  type: "All",
};
const stopWords = new Set(
  "a an and are at best brief by can creative creatives design designer designers do find for great i in is led looking me my need of on or people person please project projects show some someone studio studios talented that the their to want who with work working you".split(
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

export function interpretBrief(query: string) {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return {
    freelance:
      words.includes("freelance") ||
      words.includes("freelancer") ||
      words.includes("freelancers"),
    terms: [
      ...new Set(
        words
          .filter(
            (word) =>
              !stopWords.has(word) &&
              !["freelance", "freelancer", "freelancers"].includes(word),
          )
          .map((word) => aliases[word] ?? word),
      ),
    ],
  };
}

export function searchProfiles(
  profiles: Profile[],
  query: string,
  filters: Filters,
  muted: string[] = [],
) {
  const intent = interpretBrief(query);
  const terms = intent.terms.filter((term) => !muted.includes(term));
  const freelance = intent.freelance && !muted.includes("freelance");
  return profiles
    .filter((profile) => profile.status === "Verified")
    .filter((profile) => !freelance || profile.workStatus === "Freelance")
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
      const text = [
        profile.name,
        profile.role,
        profile.location,
        ...profile.capabilities,
        ...profile.keywords,
        ...profile.evidence,
      ]
        .join(" ")
        .toLowerCase();
      const matches = terms.filter((term) => text.includes(term));
      return {
        profile,
        score: matches.length,
        reason:
          profile.evidence.find((evidence) =>
            terms.some((term) => evidence.toLowerCase().includes(term)),
          ) ?? profile.evidence[0],
      };
    })
    .filter((result) => terms.length === 0 || result.score === terms.length)
    .sort((a, b) => b.score - a.score);
}
