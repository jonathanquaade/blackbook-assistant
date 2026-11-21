import { createHash } from "node:crypto";
import { canonicalLocation } from "./brief";
import { EMBEDDING_MODEL } from "./model";

/** Only the Notion fields the index may hold. Notes, contacts, rates and relationship fields are never read. */
export interface NotionProperty {
  type: string;
  [key: string]: unknown;
}
export interface NotionPage {
  id: string;
  last_edited_time: string;
  in_trash?: boolean;
  archived?: boolean;
  is_archived?: boolean;
  properties: Record<string, NotionProperty>;
}
export interface ManifestItem {
  file?: string;
  caption?: string;
  link?: string;
  rejected?: boolean;
  context_shot?: boolean;
  type?: string;
}
export interface IndexedImage {
  pageId: string;
  file: string;
}
export interface IndexedProject {
  idx: number;
  caption: string | null;
  link: string | null;
  images: IndexedImage[];
  contextShot: boolean;
}
export interface IndexedEntry {
  id: string;
  pageIds: string[];
  name: string;
  type: string;
  capabilities: string[];
  workStatus: string;
  locations: string[];
  employer: string | null;
  status: string;
  rating: number | null;
  lastEdited: string;
  projects: IndexedProject[];
}

function text(property?: NotionProperty) {
  const items = property?.[property.type];
  return Array.isArray(items)
    ? items.map((item: { plain_text?: string }) => item.plain_text ?? "").join("").trim()
    : "";
}
function select(property?: NotionProperty) {
  const value = property?.[property.type] as { name?: string } | null | undefined;
  return value?.name ?? null;
}
function multi(property?: NotionProperty) {
  const value = property?.[property.type];
  return Array.isArray(value) ? value.map((item: { name: string }) => item.name) : [];
}
function files(property?: NotionProperty) {
  const value = property?.[property.type];
  return Array.isArray(value) ? value.map((item: { name: string }) => item.name) : [];
}
function relationIds(property?: NotionProperty) {
  const value = property?.[property.type];
  return Array.isArray(value) ? value.map((item: { id: string }) => item.id) : [];
}

export function readEligibility(page: NotionPage) {
  const status = select(page.properties["Entry Status"]) ?? "";
  const rating = Number(select(page.properties["Rating"])) || null;
  const archived = Boolean(page.in_trash || page.archived || page.is_archived);
  return { status, rating, eligible: !archived && status === "Verified" && (rating === 4 || rating === 5) };
}

export const worksAtIds = (page: NotionPage) => relationIds(page.properties["Works At"]);

const hostOf = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

export const isContextShot = (item: ManifestItem) =>
  Boolean(item.context_shot) || /^(instagram|website|behance)\b/i.test(item.caption ?? "");

function projectsFor(page: NotionPage, manifest: ManifestItem[]) {
  const current = files(page.properties["Images"]);
  const byCaption = new Map<string, IndexedProject>();
  const projects: IndexedProject[] = [];
  const placed = new Set<string>();
  for (const item of manifest) {
    if (item.rejected || !item.caption) continue;
    if (item.file && !current.includes(item.file)) continue;
    let project = byCaption.get(item.caption);
    if (!project) {
      project = { idx: projects.length, caption: item.caption, link: item.link ?? null, images: [], contextShot: isContextShot(item) };
      byCaption.set(item.caption, project);
      projects.push(project);
    }
    if (item.file && !placed.has(item.file)) {
      project.images.push({ pageId: page.id, file: item.file });
      placed.add(item.file);
    }
  }
  const unlisted = current.filter((file) => !placed.has(file));
  if (unlisted.length)
    projects.push({ idx: projects.length, caption: null, link: null, contextShot: false, images: unlisted.map((file) => ({ pageId: page.id, file })) });
  return projects;
}

export function projectPage(
  page: NotionPage,
  manifest: ManifestItem[],
  relationNames: Record<string, string> = {},
): IndexedEntry {
  const { status, rating } = readEligibility(page);
  const p = page.properties;
  const employer =
    worksAtIds(page).map((id) => relationNames[id]).find(Boolean) ?? hostOf((p["Works At Link"]?.url as string) ?? null);
  return {
    id: page.id,
    pageIds: [page.id],
    name: text(p["Name"]),
    type: select(p["Type"]) ?? "Person",
    capabilities: multi(p["Capabilities"]),
    workStatus: select(p["Work Status"]) ?? "Unknown",
    locations: [...new Set(multi(p["Location"] ?? p["Country"]).map(canonicalLocation))],
    employer,
    status,
    rating,
    lastEdited: page.last_edited_time,
    projects: projectsFor(page, manifest),
  };
}

const nameKey = (entry: IndexedEntry) =>
  `${entry.type}:${entry.name.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "")}`;

/** One result per person: duplicate pages are merged under the most recently edited page. */
export function mergeDuplicates(entries: IndexedEntry[]) {
  const groups = new Map<string, IndexedEntry[]>();
  for (const entry of entries) groups.set(nameKey(entry), [...(groups.get(nameKey(entry)) ?? []), entry]);
  return [...groups.values()].map((group) => {
    const [primary, ...rest] = [...group].sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
    if (!rest.length) return primary;
    const projects = [...primary.projects];
    for (const other of rest)
      for (const project of other.projects) {
        const same = project.caption && projects.find((item) => item.caption === project.caption);
        if (same) same.images.push(...project.images);
        else projects.push({ ...project, idx: projects.length });
      }
    return {
      ...primary,
      pageIds: group.map((entry) => entry.id),
      capabilities: [...new Set(group.flatMap((entry) => entry.capabilities))],
      locations: [...new Set(group.flatMap((entry) => entry.locations))],
      projects,
    };
  });
}

export const roleLine = (entry: Pick<IndexedEntry, "type" | "capabilities" | "employer">) =>
  [entry.type === "Person" ? null : entry.type, entry.capabilities.join(", "), entry.employer ? `at ${entry.employer}` : null]
    .filter(Boolean)
    .join(" · ");

const evidenceProjects = (entry: IndexedEntry) => entry.projects.filter((project) => project.caption && !project.contextShot);

/** Embedding inputs: name, role and project descriptions only. */
export function embeddingInputs(entry: IndexedEntry) {
  const profileText = `${entry.name}. ${roleLine(entry)}. Work: ${evidenceProjects(entry).map((project) => project.caption).join("; ")}`;
  return [
    { projectIdx: null as number | null, text: profileText },
    ...evidenceProjects(entry).map((project) => ({
      projectIdx: project.idx as number | null,
      text: `${project.caption}. ${entry.name}, ${entry.capabilities.join(", ")}`,
    })),
  ].map((input) => ({ ...input, hash: createHash("sha256").update(`${EMBEDDING_MODEL.version}\n${input.text}`).digest("hex") }));
}
