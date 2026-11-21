export type Capability =
  | "Identity systems"
  | "Graphic design"
  | "Type design"
  | "Digital product design"
  | "Web design"
  | "3D & motion"
  | "Photography";
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
  type: "Person" | "Studio";
  location: string;
  workStatus: "Freelance" | "Studio" | "Unknown";
  capabilities: Capability[];
  summary: string;
  evidence: string[];
  keywords: string[];
  projects: Project[];
  status: "Verified" | "Needs Review";
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
