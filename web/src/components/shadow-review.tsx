"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  GROUPS,
  RESULTS,
  approvalIssue,
  entryRoute,
  handoverReason,
  orderedChecks,
  safeUrl,
  type CheckResult,
  type OwnerReviewEvent,
  type ReviewerCheck,
  type ReviewerReport,
  type ShadowEntry,
} from "@/lib/reviewer";

type QueueData = {
  entries: ShadowEntry[];
  events: OwnerReviewEvent[];
  fictional: boolean;
};
async function request<T>(body?: object, pageId?: string): Promise<T> {
  const response = await fetch(
    `/api/shadow${pageId ? `?page_id=${encodeURIComponent(pageId)}` : ""}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        }
      : { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error ?? "The request did not complete."),
      { status: response.status },
    );
  return data as T;
}

export function ShadowReview() {
  const [data, setData] = useState<QueueData | null>(null);
  const [status, setStatus] = useState<
    "loading" | "owner" | "disconnected" | "ready" | "error"
  >("loading");
  const [refresh, setRefresh] = useState(0);
  const [queue, setQueue] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [entry, setEntry] = useState<ShadowEntry | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => {
    let active = true;
    request<QueueData>()
      .then((value) => {
        if (active) {
          setData(value);
          setStatus("ready");
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setStatus(
            e.status === 401
              ? "owner"
              : e.status === 503
                ? "disconnected"
                : "error",
          );
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  const pending =
    data?.entries.filter(
      (e) =>
        !data.events.some(
          (event) =>
            event.page_id === e.page_id &&
            event.revision === e.revision &&
            event.action !== "check",
        ),
    ) ?? [];
  const visible =
    queue === "all" ? pending : pending.filter((e) => entryRoute(e) === queue);
  const selected = visible.find((e) => e.page_id === selectedId) ?? visible[0];
  const id = selected?.page_id;
  useEffect(() => {
    if (!id || queue === "history") return;
    let active = true;
    request<ShadowEntry>(undefined, id)
      .then((value) => {
        if (active) {
          setEntry(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, refresh, queue]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request({ kind: "login", key });
      setRefresh((n) => n + 1);
      setStatus("loading");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setKey("");
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await request({ kind: "logout" });
      setData(null);
      setEntry(null);
      setNotice("");
      setStatus("owner");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }
  async function save(fields: Record<string, unknown>) {
    if (!entry) return false;
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      ...fields,
      page_id: entry.page_id,
      revision: entry.revision,
      report_hash: entry.report_hash,
    };
    const signature = JSON.stringify(payload);
    if (pendingRequest.current?.signature !== signature)
      pendingRequest.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await request<{ event: OwnerReviewEvent }>({
        ...payload,
        id: pendingRequest.current.id,
      });
      pendingRequest.current = null;
      setData(
        (current) =>
          current && {
            ...current,
            events: [
              ...current.events.filter((e) => e.id !== result.event.id),
              result.event,
            ],
          },
      );
      setNotice(
        fields.kind === "check"
          ? "Your check feedback is saved. The reviewer cannot change your judgment fields."
          : "Decision saved to private review history. Nothing was written to Notion.",
      );
      if (fields.kind !== "check")
        requestAnimationFrame(() =>
          document.getElementById("shadow-content")?.focus(),
        );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback was not saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const current =
    entry?.page_id === id && entry.revision === selected?.revision
      ? entry
      : null;
  return (
    <div className="review-page shadow-page page-enter">
      <div className="review-heading">
        <div>
          <span className="eyebrow">YOUR BLACKBOOK</span>
          <h1>
            Your eye. <span>The final say.</span>
          </h1>
          <p>
            Review the work. Train your reviewer. Keep every decision yours.
          </p>
        </div>
        <span className="review-mode">
          <ShieldCheck size={14} /> Zero trust <span>L0</span>
        </span>
      </div>
      <div className="shadow-source">
        <Link href="/review">
          <ArrowLeft size={14} /> Fictional sandbox
        </Link>
        <span>
          {data?.fictional ? "Fictional training preview" : "Private Blackbook"}{" "}
          · No Notion writes
        </span>
        {status === "ready" && (
          <button className="text-button" disabled={busy} onClick={logout}>
            <LogOut size={14} /> Lock review
          </button>
        )}
      </div>
      {error && (
        <p className="shadow-message form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div className="shadow-message" role="status">
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss review notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {status === "loading" && (
        <div className="empty-state" role="status">
          Loading your private review queue…
        </div>
      )}
      {(status === "owner" || status === "disconnected") && (
        <div className="empty-state shadow-gate">
          <LockKeyhole size={27} />
          <h3>
            {status === "disconnected"
              ? "Your private queue is not connected yet."
              : "Just for your eyes."}
          </h3>
          <p>
            The sandbox stays fictional. Real entries and training feedback need
            the separate owner key. It is never stored in browser storage.
          </p>
          {status === "owner" && (
            <form onSubmit={login}>
              <label>
                Owner key
                <input
                  type="password"
                  autoComplete="current-password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  required
                  maxLength={512}
                />
              </label>
              <button className="button primary" disabled={busy}>
                Unlock private review
              </button>
            </form>
          )}
        </div>
      )}
      {status === "error" && (
        <button
          className="button secondary"
          onClick={() => setRefresh((n) => n + 1)}
        >
          Retry loading
        </button>
      )}
      {status === "ready" && data && (
        <>
          <div
            className="shadow-queues"
            role="group"
            aria-label="Shadow review queues"
          >
            {[
              ["all", "All entries"],
              ["needs_you", "Needs you"],
              ["ready", "Ready for your eye"],
              ["bounced", "Back to doer"],
              ["history", "Decisions"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={queue === value}
                onClick={() => {
                  setQueue(value);
                  setSelectedId("");
                  setNotice("");
                }}
                className={queue === value ? "selected" : ""}
              >
                {label}
                <span>
                  {value === "history"
                    ? data.events.filter((e) => e.action !== "check").length
                    : value === "all"
                      ? pending.length
                      : pending.filter((e) => entryRoute(e) === value).length}
                </span>
              </button>
            ))}
          </div>
          <div id="shadow-content" tabIndex={-1}>
            {queue === "history" ? (
              <div className="history-list">
                {[...data.events]
                  .reverse()
                  .filter((e) => e.action !== "check")
                  .map((event) => (
                    <article className="history-item" key={event.id}>
                      <Check size={18} />
                      <div>
                        <h3>
                          {data.entries.find((e) => e.page_id === event.page_id)
                            ?.name ?? "Blackbook entry"}
                        </h3>
                        <p>
                          {event.action} · {event.reason} ·{" "}
                          {new Date(event.date).toLocaleString()}
                        </p>
                        <p>{event.note}</p>
                        <small>
                          Revision {event.revision}. Private decision only, not
                          published or Verified.
                        </small>
                      </div>
                    </article>
                  ))}
                {!data.events.some((e) => e.action !== "check") && (
                  <div className="empty-state">
                    <h3>Your decisions will live here.</h3>
                    <p>
                      Agreements and disagreements are saved separately as
                      reviewer training.
                    </p>
                  </div>
                )}
              </div>
            ) : !selected ? (
              <div className="empty-state">
                <ShieldCheck size={27} />
                <h3>Nothing waiting in this queue.</h3>
                <p>Saved decisions stay private. Notion status is unchanged.</p>
              </div>
            ) : (
              <>
                <div className="queue-toolbar">
                  <div className="queue-select">
                    <select
                      aria-label="Choose a Blackbook entry"
                      value={selected.page_id}
                      onChange={(e) => {
                        setSelectedId(e.target.value);
                        setNotice("");
                      }}
                    >
                      {visible.map((e) => (
                        <option key={e.page_id} value={e.page_id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="queue-pagination">
                    <span>
                      {visible.indexOf(selected) + 1} of {visible.length}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Previous Blackbook entry"
                      disabled={visible.indexOf(selected) <= 0 || busy}
                      onClick={() =>
                        setSelectedId(
                          visible[visible.indexOf(selected) - 1].page_id,
                        )
                      }
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next Blackbook entry"
                      disabled={
                        visible.indexOf(selected) >= visible.length - 1 || busy
                      }
                      onClick={() =>
                        setSelectedId(
                          visible[visible.indexOf(selected) + 1].page_id,
                        )
                      }
                    >
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Refresh live entry and reports"
                      disabled={busy}
                      onClick={() => {
                        setEntry(null);
                        setRefresh((n) => n + 1);
                      }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </div>
                {current ? (
                  <ShadowEntryView
                    key={`${current.page_id}-${current.revision}-${current.report_hash}`}
                    entry={current}
                    events={data.events}
                    busy={busy}
                    save={save}
                  />
                ) : (
                  <div className="empty-state" role="status">
                    Loading current work and reviewer evidence…
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ShadowEntryView({
  entry,
  events,
  busy,
  save,
}: {
  entry: ShadowEntry;
  events: OwnerReviewEvent[];
  busy: boolean;
  save: (fields: Record<string, unknown>) => Promise<boolean>;
}) {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("completeness");
  const [checks, setChecks] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const image = entry.images[index];
  const issue = approvalIssue(entry);
  return (
    <article className="shadow-card">
      <section className="shadow-info" aria-label="Entry information">
        <span className="eyebrow">NEEDS REVIEW IN NOTION</span>
        <h2>{entry.name}</h2>
        <p>
          {entry.type} · {entry.location} · {entry.work_status}
        </p>
        <div className="shadow-tags">
          {entry.capabilities.map((capability) => (
            <span className="tag" key={capability}>
              {capability}
            </span>
          ))}
        </div>
        {entry.summary && (
          <>
            <h3>Scout context</h3>
            <p className="shadow-prose">{entry.summary}</p>
          </>
        )}
        {entry.questions && (
          <>
            <h3>Open questions</h3>
            <p className="shadow-prose">{entry.questions}</p>
          </>
        )}
        {entry.notes && (
          <>
            <h3>Your notes</h3>
            <p className="shadow-prose">{entry.notes}</p>
          </>
        )}
        <h3>Your judgment, read-only</h3>
        <dl className="shadow-judgments">
          {Object.entries(entry.judgments).map(([field, value]) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd>{value || "Not set"}</dd>
            </div>
          ))}
        </dl>
        <p className="fine-print">
          These are your Notion fields, never reviewer claims. Nothing here
          changes them.
        </p>
        <div className="shadow-links">
          {entry.links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
              <ExternalLink size={12} />
            </a>
          ))}
          <a
            href={`https://www.notion.so/${entry.page_id.replaceAll("-", "")}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Notion
            <ExternalLink size={12} />
          </a>
        </div>
        <small>
          Entry changed {new Date(entry.edited_at).toLocaleString()}
        </small>
      </section>
      <section className="shadow-work" aria-label="Selected work">
        <div className="shadow-work-title">
          <h2>{entry.name}</h2>
          <span>Selected work</span>
        </div>
        <div className="shadow-stage">
          {image && !failedImages.includes(image.url) ? (
            <Image
              src={image.url}
              alt={image.caption}
              width={1200}
              height={900}
              unoptimized
              referrerPolicy="no-referrer"
              onError={() =>
                setFailedImages((current) => [...current, image.url])
              }
            />
          ) : (
            <div className="empty-state">
              <CircleAlert size={25} />
              <h3>
                {image
                  ? "This image could not load."
                  : "No current work images available."}
              </h3>
              <p>
                Refresh the entry for fresh Notion media. Missing work is not a
                pass.
              </p>
            </div>
          )}
        </div>
        <div className="shadow-media-nav">
          <button
            className="icon-button"
            aria-label="Previous work image"
            disabled={index === 0}
            onClick={() => setIndex((n) => n - 1)}
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <strong>{image?.caption ?? "Work needs a check"}</strong>
            <small>
              {entry.images.length
                ? `${index + 1} of ${entry.images.length}`
                : "No images"}
              {image?.source && (
                <>
                  {" "}
                  ·{" "}
                  <a href={image.source} target="_blank" rel="noreferrer">
                    Project source
                  </a>
                </>
              )}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Next work image"
            disabled={index >= entry.images.length - 1}
            onClick={() => setIndex((n) => n + 1)}
          >
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="shadow-decision-note">
          <label>
            Decision reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="completeness">Completeness or correctness</option>
              <option value="taste">My taste or fit</option>
            </select>
          </label>
          <label>
            Feedback
            <textarea
              value={note}
              maxLength={2000}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for changes or decline. What needs to be different?"
            />
          </label>
          {reason === "completeness" &&
            Boolean(entry.report?.checks.length) && (
              <details>
                <summary>
                  Checks this decision corrects ({checks.length})
                </summary>
                <fieldset>
                  <legend>
                    Choose the named checks, not taste preferences.
                  </legend>
                  {entry.report?.checks.map((check) => (
                    <label className="shadow-checkbox" key={check.id}>
                      <input
                        type="checkbox"
                        checked={checks.includes(check.id)}
                        onChange={(e) =>
                          setChecks((current) =>
                            e.target.checked
                              ? [...current, check.id]
                              : current.filter((id) => id !== check.id),
                          )
                        }
                      />
                      {check.id} · {check.result}
                    </label>
                  ))}
                </fieldset>
              </details>
            )}
        </div>
        <div className="shadow-actions">
          {issue && (
            <p className="review-warning">
              <CircleAlert size={13} /> {issue}
            </p>
          )}
          <div className="decision-buttons">
            <button
              className="decision-button decline"
              disabled={busy}
              onClick={() => save({ kind: "reject", reason, note, checks })}
            >
              <X size={16} /> Decline
            </button>
            <button
              className="decision-button changes"
              disabled={busy}
              onClick={() =>
                save({ kind: "request-changes", reason, note, checks })
              }
            >
              Request changes
            </button>
            <button
              className="decision-button approve"
              disabled={busy || !!issue}
              onClick={() => save({ kind: "approve", reason, note, checks })}
            >
              <Check size={16} /> Approve
            </button>
          </div>
          <p className="fine-print">
            L0: you decide every entry. Saved here only. No publication or
            Notion write.
          </p>
        </div>
      </section>
      <ReviewerPanel entry={entry} events={events} busy={busy} save={save} />
    </article>
  );
}
function Evidence({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>]+)/g);
  return (
    <>
      {parts.map((part, index) => {
        const url = safeUrl(part.replace(/[),.;\]]+$/, ""));
        return url ? (
          <a href={url} key={index} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}
function ReviewerPanel({
  entry,
  events,
  busy,
  save,
}: {
  entry: ShadowEntry;
  events: OwnerReviewEvent[];
  busy: boolean;
  save: (fields: Record<string, unknown>) => Promise<boolean>;
}) {
  const r = entry.report;
  if (!r)
    return (
      <section className="shadow-report">
        <h2>Portfolio Reviewer</h2>
        <p>
          No readable report yet. This entry needs you; approval stays blocked
          until a current live check arrives.
        </p>
      </section>
    );
  const route = entryRoute(entry);
  const issue = approvalIssue(entry);
  return (
    <section className="shadow-report" aria-label="Portfolio Reviewer report">
      <div className="shadow-report-heading">
        <div>
          <span className="eyebrow">PORTFOLIO REVIEWER · SHADOW MODE</span>
          <h2>A second eye, not the final say.</h2>
        </div>
        <span
          className={`readiness ${r.verdict === "pass" ? "ready" : "needs-check"}`}
        >
          {r.verdict === "pass" ? (
            <Check size={13} />
          ) : (
            <CircleAlert size={13} />
          )}
          {r.verdict}
        </span>
      </div>
      <div className="shadow-tags">
        <span className="tag">
          {route === "needs_you"
            ? "Needs you"
            : route === "bounced"
              ? "Back to doer"
              : "Ready for your eye"}
        </span>
        <span className="tag">{r.trust_level} at review · L0 operating</span>
        {r.verdict === "fail" && (
          <>
            <span className="tag">Bounced {r.attempt} of 2</span>
            <span className="tag">Fixes: {r.to}</span>
          </>
        )}
      </div>
      {route === "needs_you" && (
        <p className="shadow-warning">
          {issue ?? handoverReason(r.handover_reason)}
        </p>
      )}
      <p className="shadow-report-summary">{r.summary}</p>
      <p className="fine-print">
        {r.live ? (
          <>
            Checked live in Notion:{" "}
            {new Date(r.live.checked_at).toLocaleString()} · {r.live.blocks}{" "}
            blocks · {r.live.images} images · Work heading{" "}
            {r.live.h2_work ? "present" : "missing"}
          </>
        ) : (
          "No live Notion check recorded. This report is not trusted."
        )}
        {r.reviewed_at && (
          <> · Reviewed {new Date(r.reviewed_at).toLocaleString()}</>
        )}
        <br />
        Reviewed revision: {r.reviewed_revision ?? "Not recorded"} · Current
        revision: {entry.revision}
      </p>
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
        <section className="shadow-check-group" key={group}>
          <h3>
            {group} · {GROUPS[group]}
          </h3>
          {orderedChecks(r.checks.filter((c) => c.group === group)).map(
            (check) => (
              <CheckFeedback
                key={check.id}
                check={check}
                report={r}
                event={[...events]
                  .reverse()
                  .find(
                    (e) =>
                      e.page_id === entry.page_id &&
                      e.revision === entry.revision &&
                      e.report_hash === entry.report_hash &&
                      e.check === check.id,
                  )}
                busy={busy}
                save={save}
              />
            ),
          )}
        </section>
      ))}
    </section>
  );
}
function CheckFeedback({
  check,
  event,
  busy,
  save,
}: {
  check: ReviewerCheck;
  report: ReviewerReport;
  event?: OwnerReviewEvent;
  busy: boolean;
  save: (fields: Record<string, unknown>) => Promise<boolean>;
}) {
  const [disagree, setDisagree] = useState(false);
  const [result, setResult] = useState<CheckResult>(
    check.result === "fail" ? "pass" : "fail",
  );
  const [note, setNote] = useState("");
  return (
    <article className={`shadow-check check-${check.result}`}>
      <div className="shadow-check-heading">
        <strong>
          {check.result === "pass" ? (
            <Check size={15} />
          ) : check.result === "fail" ? (
            <X size={15} />
          ) : (
            <CircleAlert size={15} />
          )}
          {check.id}
        </strong>
        <span>
          {check.result} ·{" "}
          {check.kind === "rule" ? "Mechanical rule" : "Reviewer read"}
        </span>
      </div>
      <p>
        <Evidence text={check.evidence} />
      </p>
      {check.result === "fail" && (
        <p className="shadow-fix">
          <strong>Fix:</strong> {check.fix}
        </p>
      )}
      <div
        className="shadow-check-controls"
        role="group"
        aria-label={`Your view on ${check.id}`}
      >
        <button
          aria-pressed={event?.result === check.result && !disagree}
          disabled={busy}
          onClick={async () => {
            if (
              await save({
                kind: "check",
                check: check.id,
                result: check.result,
                note: "",
                checks: [],
              })
            )
              setDisagree(false);
          }}
        >
          Agree
        </button>
        <button
          aria-pressed={disagree || (!!event && event.result !== check.result)}
          disabled={busy}
          onClick={() => setDisagree(true)}
        >
          Disagree
        </button>
        {event && (
          <small>
            Saved:{" "}
            {event.result === check.result
              ? "Agree"
              : `Disagree, ${event.result}`}
          </small>
        )}
      </div>
      {disagree && (
        <div className="shadow-feedback">
          <label>
            Your result
            <select
              value={result}
              onChange={(e) => setResult(e.target.value as CheckResult)}
            >
              {RESULTS.filter((value) => value !== check.result).map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Optional correction note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </label>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              if (
                await save({
                  kind: "check",
                  check: check.id,
                  result,
                  note,
                  checks: [],
                })
              )
                setDisagree(false);
            }}
          >
            Save disagreement
          </button>
          <button className="text-button" onClick={() => setDisagree(false)}>
            Cancel
          </button>
        </div>
      )}
      {event?.note && (
        <p className="feedback-quote">Your correction: {event.note}</p>
      )}
    </article>
  );
}
