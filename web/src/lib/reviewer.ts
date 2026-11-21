export const RESULTS = ["pass", "fail", "n/a", "unsure"] as const;
export type CheckResult = (typeof RESULTS)[number];
export type ReviewRoute = "ready" | "bounced" | "needs_you";
export type CheckGroup = "A" | "B" | "C" | "D";
export interface ReviewerCheck {
  id: string;
  group: CheckGroup;
  result: CheckResult;
  kind: "rule" | "read";
  evidence: string;
  fix?: string;
}
export interface ReviewerReport {
  verdict: "pass" | "fail" | "handover";
  route: ReviewRoute;
  handover_reason?: string;
  reviewed_revision: number | null;
  reviewed_at: string | null;
  attempt: 1 | 2;
  to: "scout" | "scraper" | "keeper";
  trust_level: "L0" | "L1" | "L2" | "L3";
  live: {
    blocks: number;
    images: number;
    h2_work: boolean;
    checked_at: string;
  } | null;
  summary: string;
  checks: ReviewerCheck[];
}
export interface ShadowEntry {
  page_id: string;
  name: string;
  revision: number;
  edited_at: string;
  type: string;
  location: string;
  capabilities: string[];
  work_status: string;
  summary: string;
  questions: string;
  notes: string;
  judgments: Record<
    "Rating" | "Work With?" | "Worked Together" | "Familiarity",
    string
  >;
  links: { label: string; url: string }[];
  images: { name: string; url: string; caption: string; source?: string }[];
  report: ReviewerReport | null;
  report_hash: string;
}
export interface OwnerReviewEvent {
  id: string;
  date: string;
  page_id: string;
  revision: number;
  report_hash: string;
  action: "check" | "approve" | "request-changes" | "reject";
  check?: string;
  result?: CheckResult;
  reason?: "taste" | "completeness";
  checks: string[];
  note: string;
}
export interface ReviewerCorrection {
  date: string;
  page_id: string;
  revision: number;
  check: string;
  you_said: CheckResult;
  he_said: CheckResult;
  note: string;
  event_id: string;
}
export const GROUPS: Record<CheckGroup, string> = {
  A: "The work",
  B: "Profile facts",
  C: "Judgment and honesty",
  D: "Sources and machinery",
};
const REASONS: Record<string, string> = {
  scope: "Outside the reviewer's scope.",
  judgment_conflict: "Needs Jonathan's judgment, not a reviewer guess.",
  unverifiable: "The evidence could not be verified.",
  no_rule: "There is no agreed rule for this check.",
  retry_cap: "The two-attempt retry limit was reached.",
  spot_check: "Selected for a human spot check.",
  untrusted_check: "A current revision and live check are required.",
};
export function handoverReason(reason?: string) {
  return REASONS[reason ?? ""] ?? "Jonathan needs to review this entry.";
}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function oneLine(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value
        .replace(/[\r\n]+/g, " ")
        .replaceAll("\u2014", ",")
        .slice(0, 4000)
    : fallback;
}
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* Invalid evidence remains plain text. */
  }
}
export function parseReviewerReport(value: unknown): ReviewerReport | null {
  const r = object(value);
  if (
    !["pass", "fail", "handover"].includes(String(r.verdict)) ||
    !Array.isArray(r.checks)
  )
    return null;
  const checks: ReviewerCheck[] = [];
  const ids = new Set<string>();
  for (const value of r.checks) {
    const c = object(value);
    if (
      typeof c.id !== "string" ||
      !c.id.trim() ||
      c.id.length > 200 ||
      ids.has(c.id)
    )
      return null;
    ids.add(c.id);
    const inferred = /^[ABCD]\./.test(c.id) ? c.id[0] : "D";
    const group = c.group ?? inferred;
    if (
      !["A", "B", "C", "D"].includes(String(group)) ||
      (c.group && group !== inferred)
    )
      return null;
    const knownResult = RESULTS.includes(c.result as CheckResult);
    checks.push({
      id: c.id,
      group: group as CheckGroup,
      result: knownResult ? (c.result as CheckResult) : "unsure",
      kind: c.kind === "rule" ? "rule" : "read",
      evidence: `${knownResult ? "" : `Legacy result: ${oneLine(c.result, "not recorded")}. `}${oneLine(c.evidence, "No evidence supplied.")}`,
      ...(c.result === "fail"
        ? { fix: oneLine(c.fix, "No actionable fix supplied.") }
        : {}),
    });
  }
  const l = object(r.live);
  const live =
    Number.isInteger(l.blocks) &&
    Number(l.blocks) >= 0 &&
    Number.isInteger(l.images) &&
    Number(l.images) >= 0 &&
    typeof l.h2_work === "boolean" &&
    typeof l.checked_at === "string" &&
    Number.isFinite(Date.parse(l.checked_at))
      ? {
          blocks: Number(l.blocks),
          images: Number(l.images),
          h2_work: l.h2_work,
          checked_at: l.checked_at,
        }
      : null;
  const revision =
    Number.isSafeInteger(r.reviewed_revision) && Number(r.reviewed_revision) > 0
      ? Number(r.reviewed_revision)
      : null;
  const reviewedAt =
    typeof r.reviewed_at === "string" &&
    Number.isFinite(Date.parse(r.reviewed_at))
      ? r.reviewed_at
      : null;
  const unsure = checks.some((c) => c.result === "unsure");
  const untrusted = !live || !revision || !reviewedAt || !checks.length;
  const route =
    unsure || untrusted || r.verdict === "handover"
      ? "needs_you"
      : r.route === "bounced" || r.verdict === "fail"
        ? "bounced"
        : r.route === "needs_you"
          ? "needs_you"
          : "ready";
  return {
    verdict: r.verdict as ReviewerReport["verdict"],
    route,
    handover_reason: untrusted
      ? "untrusted_check"
      : unsure
        ? "unverifiable"
        : typeof r.handover_reason === "string"
          ? r.handover_reason
          : undefined,
    reviewed_revision: revision,
    reviewed_at: reviewedAt,
    attempt: r.attempt === 2 ? 2 : 1,
    to: r.to === "scout" || r.to === "scraper" ? r.to : "keeper",
    trust_level: ["L1", "L2", "L3"].includes(String(r.trust_level))
      ? (r.trust_level as ReviewerReport["trust_level"])
      : "L0",
    live,
    summary: oneLine(
      r.summary ?? r.notes,
      "Legacy reviewer report. Check the evidence yourself.",
    ),
    checks,
  };
}
export function approvalIssue(entry: Pick<ShadowEntry, "report" | "revision">) {
  const r = entry.report;
  if (
    !r ||
    !r.live ||
    !r.reviewed_revision ||
    !r.reviewed_at ||
    !r.checks.length
  )
    return "A revision-bound report with a live Notion check is required before approval.";
  if (
    r.reviewed_revision !== entry.revision ||
    Date.parse(r.live.checked_at) < entry.revision
  )
    return "This report is stale. Refresh the review for the current entry revision before approving.";
  return null;
}
export function entryRoute(
  entry: Pick<ShadowEntry, "report" | "revision">,
): ReviewRoute {
  return approvalIssue(entry) ? "needs_you" : entry.report!.route;
}
export function orderedChecks(checks: ReviewerCheck[]) {
  const order = { fail: 0, unsure: 1, pass: 2, "n/a": 3 };
  return [...checks].sort(
    (a, b) => order[a.result] - order[b.result] || a.id.localeCompare(b.id),
  );
}
export function trainingCorrections(
  entry: ShadowEntry,
  event: OwnerReviewEvent,
): ReviewerCorrection[] {
  if (
    event.page_id !== entry.page_id ||
    event.revision !== entry.revision ||
    event.report_hash !== entry.report_hash
  )
    throw new Error(
      "The entry or reviewer report changed. Reload before saving.",
    );
  const checks = entry.report?.checks ?? [];
  const base = {
    date: event.date,
    page_id: entry.page_id,
    revision: entry.revision,
    note: event.note,
    event_id: event.id,
  };
  if (event.action === "check") {
    const check = checks.find((c) => c.id === event.check);
    if (!check || !RESULTS.includes(event.result as CheckResult))
      throw new Error("Choose a valid check and result.");
    return check.result === event.result
      ? []
      : [
          {
            ...base,
            check: check.id,
            you_said: check.result,
            he_said: event.result!,
          },
        ];
  }
  if (event.action === "approve") {
    const issue = approvalIssue(entry);
    if (issue) throw new Error(issue);
  }
  if (event.action !== "approve" && !event.note.trim())
    throw new Error("Add a reason before requesting changes or declining.");
  if (event.checks.some((id) => !checks.some((c) => c.id === id)))
    throw new Error("A selected check is no longer in this report.");
  if (event.reason !== "completeness" && event.reason !== "taste")
    throw new Error("Choose taste or completeness for this decision.");
  const contradicts =
    event.action === "approve"
      ? entry.report?.verdict === "fail"
      : entry.report?.verdict === "pass" && event.reason === "completeness";
  if (contradicts && !event.checks.length)
    throw new Error("Name the checks this completeness decision corrects.");
  if (event.reason === "taste") {
    if (event.action === "approve" && contradicts)
      throw new Error(
        "Approving a reviewer failure needs named completeness corrections.",
      );
    return [];
  }
  return checks
    .filter(
      (c) =>
        event.checks.includes(c.id) &&
        c.result !== (event.action === "approve" ? "pass" : "fail"),
    )
    .map((c) => ({
      ...base,
      check: c.id,
      you_said: c.result,
      he_said:
        event.action === "approve" ? ("pass" as const) : ("fail" as const),
    }));
}
