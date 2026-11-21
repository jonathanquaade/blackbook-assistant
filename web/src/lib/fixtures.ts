import type { Profile, Submission, Project, ArtworkKind } from "./types";

const project = (
  id: string,
  title: string,
  description: string,
  kind: ArtworkKind,
  mediaType: Project["mediaType"] = "image",
): Project => ({
  id,
  title,
  description,
  kind,
  mediaType,
  credit: "Original Blackbook demo artwork. Fictional project and attribution.",
});

export const profiles: Profile[] = [
  {
    id: "mina",
    name: "Mina Vale",
    initials: "MV",
    role: "Independent brand designer",
    type: "Person",
    location: "London, UK",
    workStatus: "Freelance",
    capabilities: ["Identity systems", "Graphic design", "Type design"],
    status: "Verified",
    revision: 1,
    summary:
      "Thoughtful identities for things you can hold. A focus on food, culture, and expressive typography.",
    evidence: [
      "Olive & Other pairs a custom wordmark with a food packaging system.",
      "Forma explores expressive editorial typography.",
    ],
    keywords: ["food", "packaging", "type", "typography", "brand", "editorial"],
    projects: [
      project(
        "olive",
        "Olive & Other",
        "Identity and packaging for an independent olive oil maker.",
        "olive",
      ),
      project(
        "forma",
        "Forma, issue 04",
        "A type-led arts journal and editorial system.",
        "type",
      ),
      project(
        "flora",
        "Common Ground",
        "A seasonal botanical identity.",
        "flora",
      ),
    ],
  },
  {
    id: "other",
    name: "Other Office",
    initials: "OO",
    role: "Independent design studio",
    type: "Studio",
    location: "Copenhagen, DK",
    workStatus: "Studio",
    capabilities: ["Identity systems", "Graphic design", "Web design"],
    status: "Verified",
    revision: 1,
    summary:
      "A small, hands-on studio working at the intersection of culture and commerce.",
    evidence: [
      "Matter uses a restrained identity across print and physical objects.",
      "Field Notes is an editorial identity with a distinct grid.",
    ],
    keywords: ["brand", "editorial", "culture", "minimal", "print", "objects"],
    projects: [
      project(
        "matter",
        "Matter, made simple",
        "A considered identity for an objects company.",
        "objects",
      ),
      project(
        "field",
        "Field Notes",
        "Editorial design for a cultural journal.",
        "editorial",
      ),
    ],
  },
  {
    id: "leo",
    name: "Leo Nakamura",
    initials: "LN",
    role: "Digital product designer",
    type: "Person",
    location: "Berlin, DE",
    workStatus: "Freelance",
    capabilities: ["Digital product design", "Web design"],
    status: "Verified",
    revision: 1,
    summary:
      "Calm, useful digital experiences. From the first interaction to the smallest detail.",
    evidence: [
      "Arc shows a financial dashboard with clear visual hierarchy.",
      "Daylight explores a focused, mobile-first planning experience.",
    ],
    keywords: [
      "product",
      "digital",
      "app",
      "interface",
      "dashboard",
      "fintech",
      "web",
      "saas",
    ],
    projects: [
      project(
        "arc",
        "Arc, a clearer picture",
        "A financial product dashboard and component system.",
        "digital",
      ),
      project(
        "daylight",
        "Daylight",
        "An independent mobile planning concept.",
        "mono",
      ),
    ],
  },
  {
    id: "ada",
    name: "Ada Rivers",
    initials: "AR",
    role: "Motion designer & art director",
    type: "Person",
    location: "Amsterdam, NL",
    workStatus: "Freelance",
    capabilities: ["3D & motion", "Graphic design"],
    status: "Verified",
    revision: 1,
    summary:
      "Playful forms, unexpected movement, and a healthy curiosity for the unfamiliar.",
    evidence: [
      "Soft Signal is a study in dimensional form and material.",
      "Orbit explores kinetic typography for a music identity.",
    ],
    keywords: [
      "motion",
      "3d",
      "animation",
      "kinetic",
      "music",
      "type",
      "experimental",
    ],
    projects: [
      project(
        "signal",
        "Soft Signal",
        "A dimensional material study. Still preview only.",
        "motion",
        "motion-study",
      ),
      project(
        "orbit",
        "Orbit Radio",
        "Kinetic identity studies. Still preview only.",
        "type",
        "motion-study",
      ),
    ],
  },
  {
    id: "ines",
    name: "Inès Laurent",
    initials: "IL",
    role: "Graphic designer & image maker",
    type: "Person",
    location: "Paris, FR",
    workStatus: "Freelance",
    capabilities: ["Graphic design", "Photography"],
    status: "Verified",
    revision: 1,
    summary:
      "Image-led stories and printed matter for independent culture, fashion, and the everyday.",
    evidence: [
      "Botanical Studies explores composition through abstract floral forms.",
      "Éditions is an independent publication design study.",
    ],
    keywords: [
      "editorial",
      "print",
      "art",
      "culture",
      "fashion",
      "image",
      "botanical",
    ],
    projects: [
      project(
        "botanical",
        "Botanical Studies",
        "Abstract image-making for an independent arts title.",
        "flora",
      ),
      project(
        "editions",
        "Éditions 07",
        "A publication about the spaces between things.",
        "editorial",
      ),
    ],
  },
  {
    id: "sam",
    name: "Sam Ellis",
    initials: "SE",
    role: "Brand & type designer",
    type: "Person",
    location: "Bristol, UK",
    workStatus: "Unknown",
    capabilities: ["Type design", "Identity systems", "Graphic design"],
    status: "Verified",
    revision: 1,
    summary:
      "Characterful type and identities that do more with less. Work status has not been confirmed.",
    evidence: [
      "Good Things combines bold typography with a food packaging system.",
      "Mono is a custom display type study.",
    ],
    keywords: ["food", "packaging", "type", "typography", "brand", "bold"],
    projects: [
      project(
        "good",
        "Good Things",
        "A bright, type-first food packaging concept.",
        "olive",
      ),
      project(
        "mono",
        "Mono Display",
        "A variable display typeface specimen.",
        "type",
      ),
    ],
  },
  {
    id: "noor",
    name: "Noor Studio",
    initials: "NS",
    role: "Identity & packaging studio",
    type: "Studio",
    location: "Rotterdam, NL",
    workStatus: "Studio",
    capabilities: ["Identity systems", "Graphic design"],
    status: "Needs Review",
    revision: 2,
    summary:
      "A compact studio making thoughtful identities and packaging for independent businesses.",
    evidence: [
      "Harvest shows a food identity across packaging and print.",
      "Common Ground explores a botanical brand system.",
    ],
    keywords: ["brand", "packaging", "food", "identity"],
    projects: [
      project(
        "harvest",
        "Harvest, naturally",
        "Packaging and identity for a small food producer.",
        "olive",
      ),
      project(
        "common",
        "Common Ground",
        "A seasonal identity for a plant shop.",
        "flora",
      ),
      project(
        "noor-type",
        "Harvest, in print",
        "An editorial extension of the Harvest identity.",
        "editorial",
      ),
    ],
  },
  {
    id: "elias",
    name: "Elias Chen",
    initials: "EC",
    role: "Independent digital designer",
    type: "Person",
    location: "Location unknown",
    workStatus: "Freelance",
    capabilities: ["Digital product design", "Web design"],
    status: "Needs Review",
    revision: 3,
    summary:
      "Digital product and web design. Current revision still needs an independent portfolio check.",
    evidence: [
      "Atlas is a dashboard concept; individual project credit needs checking.",
    ],
    keywords: ["digital", "product", "web"],
    projects: [
      project(
        "atlas",
        "Atlas",
        "Digital dashboard concept. Credit pending review.",
        "digital",
      ),
      project(
        "missing",
        "Project source pending",
        "Media is missing. Open the review findings for the next step.",
        "mono",
        "missing",
      ),
    ],
  },
  {
    id: "rosa",
    name: "Rosa Bell",
    initials: "RB",
    role: "Graphic designer",
    type: "Person",
    location: "Manchester, UK",
    workStatus: "Freelance",
    capabilities: ["Graphic design", "Type design"],
    status: "Needs Review",
    revision: 1,
    summary:
      "Expressive graphic design across culture, publication, and independent brands.",
    evidence: [
      "Type Index is a typographic publication study.",
      "Sunday explores a restrained identity for an objects shop.",
    ],
    keywords: ["type", "editorial", "culture", "brand"],
    projects: [
      project(
        "index",
        "Type Index",
        "An independent typography publication.",
        "type",
      ),
      project(
        "sunday",
        "Sunday Objects",
        "Identity and print for a small objects shop.",
        "objects",
      ),
      project(
        "index-print",
        "Type Index, in print",
        "An editorial extension of the publication study.",
        "editorial",
      ),
    ],
  },
];

export const submissions: Submission[] = [
  {
    id: "review-noor",
    profileId: "noor",
    revision: 2,
    reviewer: {
      verdict: "pass",
      revision: 2,
      findings: [
        "Identity and project credit checked against this revision.",
        "Two distinct project systems with packaging and print detail.",
        "Protected fields unchanged. No unresolved factual conflicts.",
      ],
    },
    changes: [
      {
        field: "Capabilities",
        before: "Graphic design",
        after: "Graphic design, Identity systems",
      },
      {
        field: "Portfolio",
        before: "1 project",
        after: "2 project systems, 3 sample images",
      },
    ],
    questions: ["Does the work feel right for your Blackbook?"],
  },
  {
    id: "review-rosa",
    profileId: "rosa",
    revision: 1,
    reviewer: {
      verdict: "pass",
      revision: 1,
      findings: [
        "Independent check matches revision 1.",
        "Two distinct projects with clear descriptions.",
        "No changes to owner notes or ratings.",
      ],
    },
    changes: [
      {
        field: "Portfolio",
        before: "Not captured",
        after: "2 distinct projects",
      },
      { field: "Work status", before: "Unknown", after: "Freelance" },
    ],
    questions: ["Would you work with them?"],
  },
  {
    id: "review-elias",
    profileId: "elias",
    revision: 3,
    reviewer: {
      verdict: "pass",
      revision: 2,
      findings: [
        "The last reviewer pass covered revision 2, not the current revision.",
        "One project has no media. Individual contribution is not confirmed.",
        "Keep this proposal out of Explore until checked.",
      ],
    },
    changes: [
      {
        field: "Portfolio",
        before: "1 project",
        after: "2 projects, 1 missing media",
      },
      { field: "Location", before: "Unknown", after: "Unknown (not inferred)" },
    ],
    questions: [
      "Check project credit and capture the missing work before review.",
    ],
  },
];

export const profileById = (id: string) =>
  profiles.find((profile) => profile.id === id);
