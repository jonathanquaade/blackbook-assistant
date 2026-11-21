export const CAPABILITIES = [
  "3D & motion",
  "Art practice",
  "Backend development",
  "Brand strategy",
  "Copywriting",
  "Creative direction",
  "Creative technology",
  "Digital product design",
  "Fabrication",
  "Film & video production",
  "Frontend development (apps)",
  "Frontend development (web)",
  "Graphic design",
  "Identity systems",
  "Illustration",
  "Industrial design",
  "Insights & research",
  "Paper & materials",
  "Photography",
  "Print production",
  "Product design",
  "Social media content",
  "Sound design",
  "Spatial & exhibition design",
  "Type design",
  "Web design",
] as const;
export type Capability = (typeof CAPABILITIES)[number];
export const PROFILE_TYPES = [
  "Agency",
  "Foundry",
  "Person",
  "Publication",
  "Studio",
] as const;
export const WORK_STATUSES = [
  "Employed",
  "Freelance",
  "Studio",
  "Unknown",
] as const;
export type EntryStatus =
  "New" | "Enriching" | "Needs Review" | "Verified" | "Revisit" | "Rejected";
export type ArtworkKind =
  | "olive"
  | "type"
  | "digital"
  | "motion"
  | "editorial"
  | "objects"
  | "flora"
  | "mono";

export interface Project {
  id: string;
  title: string;
  description: string;
  kind: ArtworkKind;
  credit: string;
  mediaType: "image" | "motion-study" | "missing";
}

export interface Profile {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: (typeof PROFILE_TYPES)[number];
  location: string;
  workStatus: (typeof WORK_STATUSES)[number];
  capabilities: Capability[];
  summary: string;
  evidence: string[];
  keywords: string[];
  projects: Project[];
  status: EntryStatus;
  rating?: 1 | 2 | 3 | 4 | 5 | null;
  workWith?: "Definitely" | "Yes" | "In a pinch" | "No" | "Unvetted" | null;
  workedTogether?: "Never" | "Once" | "Repeatedly" | null;
  revision: number;
}

export interface Submission {
  id: string;
  profileId: string;
  revision: number;
  reviewer: {
    verdict: "pass" | "fail" | "unknown";
    revision: number | null;
    findings: string[];
  };
  changes: { field: string; before: string; after: string }[];
  questions: string[];
}

export type DecisionAction = "approve" | "request-changes" | "reject";
export interface Decision {
  id: string;
  submissionId: string;
  revision: number;
  action: DecisionAction;
  note: string;
  createdAt: string;
  edits?: { field: string; before: string; after: string }[];
}

export interface Addition {
  id: string;
  input: string;
  note: string;
  createdAt: string;
}

export interface WorkspaceState {
  version: 1;
  shortlist: string[];
  decisions: Decision[];
  additions: Addition[];
}
