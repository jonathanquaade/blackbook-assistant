"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  FilePenLine,
  Layers,
  MapPin,
  MessageSquare,
  Pencil,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { profileById, submissions } from "@/lib/fixtures";
import { decisionFor, isReady } from "@/lib/workspace";
import { CAPABILITIES, WORK_STATUSES, type DecisionAction, type Profile, type Submission } from "@/lib/types";
import { Artwork } from "./artwork";
import { useWorkspace } from "./workspace-provider";

type Queue = "ready" | "check" | "history" | "submitted";
const actionLabels = {
  approve: "Approved in demo",
  "request-changes": "Changes requested",
  reject: "Declined in demo",
};

export function Review() {
  const { state } = useWorkspace();
  const [queue, setQueue] = useState<Queue>("ready");
  const [selectedId, setSelectedId] = useState("");
  const pending = submissions.filter(
    (submission) => !decisionFor(state, submission),
  );
  const ready = pending.filter(isReady);
  const needsCheck = pending.filter((submission) => !isReady(submission));
  const visible = queue === "ready" ? ready : needsCheck;
  const selected =
    visible.find((submission) => submission.id === selectedId) ?? visible[0];
  const index = visible.findIndex(
    (submission) => submission.id === selected?.id,
  );
  const profile = selected ? profileById(selected.profileId) : undefined;
  const tabs: { value: Queue; label: string; count: number }[] = [
    { value: "ready", label: "Ready for you", count: ready.length },
    { value: "check", label: "Needs a check", count: needsCheck.length },
    { value: "history", label: "Decisions", count: state.decisions.length },
    { value: "submitted", label: "Submitted", count: state.additions.length },
  ];
  return (
    <div className="review-page page-enter">
      <div className="review-heading">
        <div>
          <span className="eyebrow">A CONSIDERED COLLECTION</span>
          <h1>
            Your eye. <span>The final say.</span>
          </h1>
          <p>
            Take a closer look. Keep what feels right. Tell us what doesn’t.
          </p>
        </div>
        <span className="review-mode">
          <ShieldCheck size={14} /> Owner review <span>Demo</span>
        </span>
      </div>
      <div className="review-tabs" role="tablist" aria-label="Review queues">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={queue === tab.value}
            aria-controls="review-content"
            id={`tab-${tab.value}`}
            tabIndex={queue === tab.value ? 0 : -1}
            className={queue === tab.value ? "selected" : ""}
            onClick={() => setQueue(tab.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const next =
                  tabs[
                    (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 3)) %
                      tabs.length
                  ];
                setQueue(next.value);
                document.getElementById(`tab-${next.value}`)?.focus();
              }
            }}
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
      </div>
      <div id="review-content" role="tabpanel" aria-labelledby={`tab-${queue}`}>
        {(queue === "ready" || queue === "check") && (
          <>
            {visible.length > 0 && selected && profile ? (
              <>
                <div className="queue-toolbar">
                  <div className="queue-select">
                    <Layers size={14} />
                    <select
                      aria-label="Choose a proposal"
                      value={selected.id}
                      onChange={(event) => setSelectedId(event.target.value)}
                    >
                      {visible.map((submission) => (
                        <option key={submission.id} value={submission.id}>
                          {profileById(submission.profileId)?.name}, revision{" "}
                          {submission.revision}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} />
                  </div>
                  <div className="queue-pagination">
                    <span>
                      {index + 1} of {visible.length}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Previous proposal"
                      disabled={index === 0}
                      onClick={() => setSelectedId(visible[index - 1].id)}
                    >
                      <ArrowLeft size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next proposal"
                      disabled={index === visible.length - 1}
                      onClick={() => setSelectedId(visible[index + 1].id)}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
                <ReviewEntry
                  key={`${selected.id}-${selected.revision}`}
                  submission={selected}
                  profile={profile}
                />
              </>
            ) : (
              <div className="empty-state review-empty">
                <span className="empty-icon">
                  <CheckCheck size={27} />
                </span>
                <h3>
                  {queue === "ready"
                    ? "All caught up. A good feeling."
                    : "Nothing waiting on a check."}
                </h3>
                <p>
                  {queue === "ready" && needsCheck.length > 0
                    ? "There’s still a proposal that needs an independent check. It won’t enter your ready queue early."
                    : "Your decisions are saved locally. Reset the demo to try the flow again."}
                </p>
                {queue === "ready" && needsCheck.length > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => setQueue("check")}
                  >
                    See what needs a check <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {queue === "history" && (
          <div className="history-list">
            {state.decisions.length === 0 ? (
              <div className="empty-state">
                <Clock3 size={26} />
                <h3>Your decisions will live here.</h3>
                <p>
                  Review a sample proposal to try approval, feedback, and
                  decline.
                </p>
              </div>
            ) : (
              [...state.decisions].reverse().map((decision) => {
                const submission = submissions.find(
                  (item) => item.id === decision.submissionId,
                );
                return (
                  <article className="history-item" key={decision.id}>
                    <div className={`history-icon ${decision.action}`}>
                      {decision.action === "approve" ? (
                        <Check size={18} />
                      ) : decision.action === "reject" ? (
                        <X size={18} />
                      ) : (
                        <MessageSquare size={18} />
                      )}
                    </div>
                    <div>
                      <div className="history-title">
                        <h3>
                          {submission
                            ? profileById(submission.profileId)?.name
                            : "Demo proposal"}
                        </h3>
                        <span className="tag">
                          {actionLabels[decision.action]}
                        </span>
                      </div>
                      <small>
                        Revision {decision.revision} ·{" "}
                        {new Date(decision.createdAt).toLocaleString()}
                      </small>
                      {decision.note && (
                        <p className="feedback-quote">{decision.note}</p>
                      )}
                      {decision.edits?.map((edit, i) => (
                        <p className="history-edit" key={`${edit.field}-${i}`}>
                          <strong>{edit.field}:</strong> {edit.before}{" "}
                          <ArrowRight size={11} /> {edit.after}
                        </p>
                      ))}
                      <p className="fine-print">
                        Local demo decision only. No Notion write or live
                        publication.
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
        {queue === "submitted" && (
          <div className="history-list">
            {state.additions.length === 0 ? (
              <div className="empty-state">
                <FilePenLine size={27} />
                <h3>Someone in mind?</h3>
                <p>
                  Use Add for review to save a name or portfolio URL to this
                  demo.
                </p>
              </div>
            ) : (
              [...state.additions].reverse().map((addition) => (
                <article className="history-item" key={addition.id}>
                  <div className="history-icon">
                    <ExternalLink size={17} />
                  </div>
                  <div>
                    <h3 className="submitted-input">{addition.input}</h3>
                    <small>
                      {new Date(addition.createdAt).toLocaleString()} · Saved on
                      this browser
                    </small>
                    {addition.note && (
                      <p className="feedback-quote">{addition.note}</p>
                    )}
                    <span className="tag">
                      Demo submission, no bot job started
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewEntry({
  submission,
  profile,
}: {
  submission: Submission;
  profile: Profile;
}) {
  const { decide } = useWorkspace();
  const [projectIndex, setProjectIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: profile.name,
    role: profile.role,
    location: profile.location,
    workStatus: profile.workStatus,
  });
  const [draftCapabilities, setDraftCapabilities] = useState(
    profile.capabilities,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const project = profile.projects[projectIndex];
  const ready = isReady(submission);
  const detailEdits = (Object.keys(draft) as (keyof typeof draft)[])
    .filter((field) => draft[field].trim() !== profile[field])
    .map((field) => ({
      field,
      before: profile[field],
      after: draft[field].trim(),
    }));
  const edits = [
    ...detailEdits,
    ...(draftCapabilities.join(", ") !== profile.capabilities.join(", ")
      ? [
          {
            field: "Capabilities",
            before: profile.capabilities.join(", "),
            after: draftCapabilities.join(", "),
          },
        ]
      : []),
  ];
  function decision(action: DecisionAction) {
    if (editing) {
      setError("Save your detail edits before deciding.");
      return;
    }
    if ((action === "request-changes" || action === "reject") && !note.trim()) {
      setError(
        action === "reject"
          ? "Add a reason for declining this entry."
          : "Tell us what needs to change.",
      );
      noteRef.current?.focus();
      return;
    }
    decide(submission, action, note, edits);
  }
  function saveEdits() {
    if (
      !draft.name.trim() ||
      !draft.role.trim() ||
      !draft.location.trim() ||
      !draftCapabilities.length
    ) {
      setError(
        "Keep name, role, location, and at least one capability. Use Unknown where appropriate.",
      );
      return;
    }
    setEditing(false);
    setError("");
  }
  return (
    <article className="review-card">
      <div className="review-info">
        <div className="review-info-top">
          <span className={`readiness ${ready ? "ready" : "needs-check"}`}>
            {ready ? <CheckCheck size={12} /> : <CircleAlert size={12} />}{" "}
            {ready ? "Ready for your eye" : "Independent check needed"}
          </span>
          <span className="revision-label">v{submission.revision}</span>
        </div>
        <div className="review-identity">
          <span className="avatar large-avatar">{profile.initials}</span>
          <button
            className="button small secondary"
            onClick={() => {
              if (editing) saveEdits();
              else setEditing(true);
            }}
          >
            <Pencil size={12} />
            {editing ? "Save details" : "Edit details"}
          </button>
        </div>
        {editing ? (
          <div className="detail-form">
            <label>
              Name
              <input
                value={draft.name}
                maxLength={120}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              Role
              <input
                value={draft.role}
                maxLength={160}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value })
                }
              />
            </label>
            <label>
              Location
              <input
                value={draft.location}
                maxLength={120}
                onChange={(event) =>
                  setDraft({ ...draft, location: event.target.value })
                }
              />
            </label>
            <label>
              Work status
              <select
                value={draft.workStatus}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    workStatus: event.target.value as Profile["workStatus"],
                  })
                }
              >
                {WORK_STATUSES.map(status => <option key={status}>{status}</option>)}
              </select>
            </label>
            <fieldset className="capability-editor">
              <legend>Capabilities</legend>
              {CAPABILITIES.filter(capability => capability !== "Product design" || draftCapabilities.includes(capability)).map((capability) => (
                <label key={capability}>
                  <input
                    type="checkbox"
                    checked={draftCapabilities.includes(capability)}
                    onChange={(event) =>
                      setDraftCapabilities(
                        event.target.checked
                          ? [...draftCapabilities, capability].sort()
                          : draftCapabilities.filter(
                              (item) => item !== capability,
                            ),
                      )
                    }
                  />
                  {capability === "Product design" ? "Product design (legacy)" : capability}
                </label>
              ))}
            </fieldset>
            <button
              className="text-button"
              onClick={() => {
                setDraft({
                  name: profile.name,
                  role: profile.role,
                  location: profile.location,
                  workStatus: profile.workStatus,
                });
                setDraftCapabilities(profile.capabilities);
                setEditing(false);
                setError("");
              }}
            >
              Discard detail edits
            </button>
          </div>
        ) : (
          <>
            <h2>{draft.name}</h2>
            <p className="review-role">{draft.role}</p>
            <span className="location">
              <MapPin size={12} />
              {draft.location}
              <span>·</span>
              {draft.workStatus}
            </span>
          </>
        )}
        <p className="review-bio">{profile.summary}</p>
        <div className="tag-list">
          {draftCapabilities.map((capability) => (
            <span className="tag" key={capability}>
              {capability}
            </span>
          ))}
        </div>
        {edits.length > 0 && (
          <div className="pending-edits">
            <div className="draft-edits">
              <Pencil size={12} />
              {edits.length} detail edit{edits.length > 1 ? "s" : ""} will be
              recorded with your demo decision.
            </div>
            {edits.map((edit) => (
              <div className="field-diff" key={edit.field}>
                <strong>{edit.field}</strong>
                <del>{edit.before}</del>
                <span>
                  <ArrowRight size={11} />
                  {edit.after}
                </span>
              </div>
            ))}
          </div>
        )}
        <details className="review-disclosure" open={!ready}>
          <summary>
            {ready ? <ShieldCheck size={14} /> : <CircleAlert size={14} />}{" "}
            Independent reviewer <span>{ready ? "Pass" : "Stale"}</span>
            <ChevronDown size={13} />
          </summary>
          <div>
            {submission.reviewer.findings.map((finding) => (
              <p key={finding}>
                {ready ? <Check size={12} /> : <CircleAlert size={12} />}
                <span>{finding}</span>
              </p>
            ))}
            <small>
              Demo checklist, revision{" "}
              {submission.reviewer.revision ?? "unknown"}. No live reviewer run.
            </small>
          </div>
        </details>
        <details className="review-disclosure">
          <summary>
            <Layers size={14} /> What changed{" "}
            <span>{submission.changes.length}</span>
            <ChevronDown size={13} />
          </summary>
          <div>
            {submission.changes.map((change) => (
              <div className="field-diff" key={change.field}>
                <strong>{change.field}</strong>
                <del>{change.before}</del>
                <span>
                  <ArrowRight size={11} />
                  {change.after}
                </span>
              </div>
            ))}
            <small>
              Illustrative revision diff, not a live Notion comparison.
            </small>
          </div>
        </details>
        <div className="review-question">
          <span className="eyebrow">YOUR CALL</span>
          {submission.questions.map((question) => (
            <p key={question}>{question}</p>
          ))}
        </div>
        <label htmlFor="review-feedback" className="feedback-label">
          A note for the next pass{" "}
          <span>Required to decline or request changes</span>
        </label>
        <textarea
          id="review-feedback"
          ref={noteRef}
          rows={3}
          value={note}
          maxLength={3000}
          onChange={(event) => {
            setNote(event.target.value);
            setError("");
          }}
          placeholder="What works, what’s missing, or why it isn’t right…"
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          Fictional entry. Detail edits and feedback stay in this browser,
          separate from owner Notes.
        </p>
      </div>
      <div className="review-work">
        <div className="work-stage">
          <Artwork project={project} variation={projectIndex} />
          <div className="stage-top">
            <span>SELECTED WORK</span>
            <span>
              {projectIndex + 1} / {profile.projects.length}
            </span>
          </div>
          {profile.projects.length > 1 && (
            <>
              <button
                className="stage-arrow previous"
                aria-label="Previous project"
                disabled={projectIndex === 0}
                onClick={() => setProjectIndex(projectIndex - 1)}
              >
                <ArrowLeft size={18} />
              </button>
              <button
                className="stage-arrow next"
                aria-label="Next project"
                disabled={projectIndex === profile.projects.length - 1}
                onClick={() => setProjectIndex(projectIndex + 1)}
              >
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
        <div className="review-work-caption">
          <div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
          </div>
          <span className="sample-label">SAMPLE WORK</span>
        </div>
        <div className="project-thumbnails" aria-label="Portfolio projects">
          {profile.projects.map((item, index) => (
            <button
              key={item.id}
              className={projectIndex === index ? "selected" : ""}
              aria-label={`Show ${item.title}`}
              aria-pressed={projectIndex === index}
              onClick={() => setProjectIndex(index)}
            >
              <Artwork project={item} variation={index} />
            </button>
          ))}
          <div className="art-credit">
            Original preview artwork.
            <br />
            Fictional project & attribution.
          </div>
        </div>
        <div className="review-action-rail">
          <div className="decision-buttons">
            <button
              className="decision-button decline"
              onClick={() => decision("reject")}
            >
              <X size={18} />
              <span>Decline</span>
            </button>
            <button
              className="decision-button changes"
              onClick={() => decision("request-changes")}
            >
              <RotateCcw size={17} />
              <span>Request changes</span>
            </button>
            <button
              className="decision-button approve"
              disabled={!ready}
              onClick={() => decision("approve")}
              title={
                ready
                  ? "Save approval in this demo only"
                  : "This revision needs an independent check"
              }
            >
              <Check size={19} />
              <span>Approve</span>
            </button>
          </div>
          <p>
            {ready
              ? "Your taste is the benchmark. Demo decisions do not publish or change Notion."
              : "Approval is blocked until an independent check matches this revision."}
          </p>
        </div>
      </div>
    </article>
  );
}
