"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  emptyWorkspace,
  parseWorkspace,
  recordDecision,
  saveReviewDraft,
} from "@/lib/workspace";
import type {
  Addition,
  Decision,
  DecisionAction,
  Submission,
  WorkspaceState,
  ReviewDetails,
} from "@/lib/types";

const KEY = "blackbook-sandbox-v1";
let cachedRaw: string | null = null;
let cachedState = emptyWorkspace;
let memoryOnly = false;
const getServerSnapshot = () => emptyWorkspace;
function getSnapshot() {
  if (memoryOnly) return cachedState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedState = parseWorkspace(raw);
    }
  } catch {
    memoryOnly = true;
  }
  return cachedState;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("blackbook:change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("blackbook:change", callback);
  };
}
function save(state: WorkspaceState) {
  cachedState = state;
  cachedRaw = JSON.stringify(state);
  try {
    window.localStorage.setItem(KEY, cachedRaw);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event("blackbook:change"));
  return !memoryOnly;
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  hydrated: boolean;
  notice: string;
  notify: (message: string) => void;
  toggleShortlist: (id: string) => void;
  decide: (
    submission: Submission,
    action: DecisionAction,
    note: string,
    edits?: Decision["edits"],
  ) => boolean;
  add: (input: string, note: string) => void;
  saveDetails: (submission: Submission, details: ReviewDetails) => boolean;
  discardDetails: (submission: Submission) => void;
  reset: () => void;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [notice, setNotice] = useState("");
  const persist = (next: WorkspaceState, message: string) =>
    setNotice(
      save(next)
        ? message
        : `${message} Browser storage is unavailable; this session only.`,
    );
  const value: WorkspaceContextValue = {
    state,
    hydrated,
    notice,
    notify: setNotice,
    toggleShortlist: (id) => {
      const current = getSnapshot();
      const exists = current.shortlist.includes(id);
      persist(
        {
          ...current,
          shortlist: exists
            ? current.shortlist.filter((item) => item !== id)
            : [...current.shortlist, id],
        },
        exists
          ? "Removed from your shortlist."
          : "Saved to your private shortlist on this browser.",
      );
    },
    decide: (submission, action, note, edits) => {
      try {
        const next = recordDecision(getSnapshot(), submission, {
          id: crypto.randomUUID(),
          submissionId: submission.id,
          revision: submission.revision,
          action,
          note,
          edits,
          createdAt: new Date().toISOString(),
        });
        persist(
          next,
          "Demo decision saved on this browser. Notion is unchanged.",
        );
        return true;
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Could not save decision.",
        );
        return false;
      }
    },
    add: (input, note) => {
      const addition: Addition = {
        id: crypto.randomUUID(),
        input: input.trim(),
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      const current = getSnapshot();
      persist(
        { ...current, additions: [...current.additions, addition] },
        "Added to your demo submission list. No live research has been started.",
      );
    },
    saveDetails: (submission, details) => {
      try {
        persist(
          saveReviewDraft(getSnapshot(), submission, details),
          "Detail draft saved in this browser. No decision or Notion write.",
        );
        return true;
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not save detail draft.",
        );
        return false;
      }
    },
    discardDetails: (submission) => {
      const current = getSnapshot();
      persist(
        {
          ...current,
          drafts: current.drafts.filter(
            (draft) =>
              draft.submissionId !== submission.id ||
              draft.revision !== submission.revision,
          ),
        },
        "Detail draft discarded. Original demo facts restored.",
      );
    },
    reset: () =>
      persist(
        emptyWorkspace,
        "Sandbox reset. Your local demo decisions and shortlist were cleared.",
      ),
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is required.");
  return value;
}
