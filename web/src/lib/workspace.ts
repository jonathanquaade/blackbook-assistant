import {
  CAPABILITIES,
  WORK_STATUSES,
  type Addition,
  type Decision,
  type ReviewDetails,
  type ReviewDraft,
  type Submission,
  type WorkspaceState,
} from "./types";

export const emptyWorkspace: WorkspaceState = {
  version: 1,
  shortlist: [],
  decisions: [],
  additions: [],
  drafts: [],
};
export const isReady = (submission: Submission) =>
  submission.reviewer.verdict === "pass" &&
  submission.reviewer.revision === submission.revision;
export const decisionFor = (state: WorkspaceState, submission: Submission) =>
  state.decisions.find(
    (decision) =>
      decision.submissionId === submission.id &&
      decision.revision === submission.revision,
  );

export const draftFor = (state: WorkspaceState, submission: Submission) =>
  state.drafts.find(
    (draft) =>
      draft.submissionId === submission.id &&
      draft.revision === submission.revision,
  );

function validDetails(details: ReviewDetails) {
  return (
    !!details &&
    typeof details.name === "string" &&
    !!details.name.trim() &&
    details.name.length <= 120 &&
    typeof details.role === "string" &&
    !!details.role.trim() &&
    details.role.length <= 160 &&
    typeof details.location === "string" &&
    !!details.location.trim() &&
    details.location.length <= 120 &&
    WORK_STATUSES.includes(details.workStatus) &&
    Array.isArray(details.capabilities) &&
    details.capabilities.length > 0 &&
    details.capabilities.every((capability) =>
      CAPABILITIES.includes(capability),
    )
  );
}

export function saveReviewDraft(
  state: WorkspaceState,
  submission: Submission,
  details: ReviewDetails,
): WorkspaceState {
  if (decisionFor(state, submission))
    throw new Error("This revision already has a decision.");
  if (!validDetails(details))
    throw new Error(
      "Keep name, role, location, and at least one valid capability.",
    );
  return {
    ...state,
    drafts: [
      ...state.drafts.filter((draft) => draft.submissionId !== submission.id),
      {
        submissionId: submission.id,
        revision: submission.revision,
        details: {
          name: details.name.trim(),
          role: details.role.trim(),
          location: details.location.trim(),
          workStatus: details.workStatus,
          capabilities: [...new Set(details.capabilities)].sort(),
        },
      },
    ],
  };
}

export function recordDecision(
  state: WorkspaceState,
  submission: Submission,
  decision: Decision,
): WorkspaceState {
  if (
    decision.submissionId !== submission.id ||
    decision.revision !== submission.revision
  )
    throw new Error(
      "This revision changed. Reload the proposal before deciding.",
    );
  if (decisionFor(state, submission))
    throw new Error("This revision already has a decision.");
  if (decision.action === "approve" && !isReady(submission))
    throw new Error(
      "An independent check of this revision is required before approval.",
    );
  if (
    (decision.action === "request-changes" || decision.action === "reject") &&
    !decision.note.trim()
  )
    throw new Error("Add a reason so the next pass knows what to change.");
  return {
    ...state,
    drafts: state.drafts.filter(
      (draft) =>
        draft.submissionId !== submission.id ||
        draft.revision !== submission.revision,
    ),
    decisions: [
      ...state.decisions,
      { ...decision, note: decision.note.trim() },
    ],
  };
}

export function parseWorkspace(raw: string | null): WorkspaceState {
  if (!raw) return emptyWorkspace;
  try {
    const value = JSON.parse(raw) as Partial<WorkspaceState>;
    if (
      value.version !== 1 ||
      !Array.isArray(value.shortlist) ||
      !Array.isArray(value.decisions) ||
      !Array.isArray(value.additions)
    )
      return emptyWorkspace;
    return {
      version: 1,
      drafts: Array.isArray(value.drafts)
        ? value.drafts.filter(
            (item): item is ReviewDraft =>
              !!item &&
              typeof item.submissionId === "string" &&
              Number.isInteger(item.revision) &&
              validDetails(item.details),
          )
        : [],
      shortlist: value.shortlist.filter(
        (id): id is string => typeof id === "string",
      ),
      decisions: value.decisions.filter(
        (item): item is Decision =>
          !!item &&
          typeof item.id === "string" &&
          typeof item.submissionId === "string" &&
          Number.isInteger(item.revision) &&
          ["approve", "request-changes", "reject"].includes(item.action) &&
          typeof item.note === "string" &&
          typeof item.createdAt === "string" &&
          (item.edits === undefined ||
            (Array.isArray(item.edits) &&
              item.edits.every(
                (edit) =>
                  !!edit &&
                  typeof edit.field === "string" &&
                  typeof edit.before === "string" &&
                  typeof edit.after === "string",
              ))),
      ),
      additions: value.additions.filter(
        (item): item is Addition =>
          !!item &&
          typeof item.id === "string" &&
          typeof item.input === "string" &&
          typeof item.note === "string" &&
          typeof item.createdAt === "string",
      ),
    };
  } catch {
    return emptyWorkspace;
  }
}

export function validateAddition(input: string) {
  const trimmed = input.trim();
  if (trimmed.length < 2) return "Enter a name or a portfolio URL.";
  if (trimmed.length > 500) return "Keep the name or URL under 500 characters.";
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    try {
      if (!["http:", "https:"].includes(new URL(trimmed).protocol))
        return "Use an http or https portfolio URL.";
    } catch {
      return "Enter a complete portfolio URL.";
    }
  }
  return null;
}
