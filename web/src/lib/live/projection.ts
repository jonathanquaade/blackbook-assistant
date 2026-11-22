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
  url?: string;
  rejected?: boolean;
  context_shot?: boolean;
  type?: string;
}
export interface IndexedImage {
  pageId: string;
  file: string;
  source?: string;
}
export interface IndexedProject {
  idx: number;
  caption: string | null;
  link: string | null;
  media: string[];
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
  /** Page id of the employer when `employer` is its name; checked for eligibility again at query time. */
  employerId?: string | null;
  /** Works At Link host, shown instead if the employer page stops being eligible. */
  employerFallback?: string | null;
  /** Normalised Website/Instagram/LinkedIn keys, used only to decide duplicates. Stripped before indexing. */
  identity?: string[];
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

export function pageTitleOf(page: NotionPage) {
  const title = Object.values(page.properties).find((property) => property.type === "title");
  return text(title);
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
  const rejected = new Set(manifest.filter((item) => item.rejected).map((item) => item.file));
  const current = files(page.properties["Images"]).filter((file) => !rejected.has(file));
  const byCaption = new Map<string, IndexedProject>();
  const projects: IndexedProject[] = [];
  const placed = new Set<string>();
  for (const item of manifest) {
    if (item.rejected || !item.caption) continue;
    if (item.file && !current.includes(item.file)) continue;
    const media = item.type === "embed" ? safeProjectUrl(item.url ?? "") : null;
    const link = safeProjectUrl(item.link ?? "") ??
      (item.type === "bookmark" ? safeProjectUrl(item.url ?? "") : null);
    let project = byCaption.get(item.caption);
    if (!project) {
      project = { idx: projects.length, caption: item.caption, link, media: [], images: [], contextShot: isContextShot(item) };
      byCaption.set(item.caption, project);
      projects.push(project);
    }
    project.link ??= link;
    if (media && !project.media.includes(media)) project.media.push(media);
    if (item.file && !placed.has(item.file)) {
      project.images.push({ pageId: page.id, file: item.file, ...(link ? { source: link } : {}) });
      placed.add(item.file);
    }
  }
  const unlisted = current.filter((file) => !placed.has(file));
  if (unlisted.length)
    projects.push({ idx: projects.length, caption: null, link: null, media: [], contextShot: false, images: unlisted.map((file) => ({ pageId: page.id, file })) });
  return projects;
}

function safeProjectUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function projectPage(
  page: NotionPage,
  manifest: ManifestItem[],
  relationNames: Record<string, string> = {},
): IndexedEntry {
  const { status, rating } = readEligibility(page);
  const p = page.properties;
  // relationNames must hold only employer pages that pass eligibility themselves.
  const employerId = worksAtIds(page).find((id) => relationNames[id]) ?? null;
  const employerFallback = hostOf((p["Works At Link"]?.url as string) ?? null);
  const employer = employerId ? relationNames[employerId] : employerFallback;
  return {
    id: page.id,
    pageIds: [page.id],
    name: text(p["Name"]),
    type: select(p["Type"]) ?? "Person",
    capabilities: multi(p["Capabilities"]),
    workStatus: select(p["Work Status"]) ?? "Unknown",
    locations: [...new Set(multi(p["Location"] ?? p["Country"]).map(canonicalLocation))],
    employer,
    employerId,
    employerFallback,
    identity: identityKeys(page),
    status,
    rating,
    lastEdited: page.last_edited_time,
    projects: projectsFor(page, manifest),
  };
}

const nameKey = (entry: IndexedEntry) =>
  `${entry.type}:${entry.name.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "")}`;

/** Website, Instagram and LinkedIn reduced to host/path, so two pages for one person share a key. */
function identityKeys(page: NotionPage) {
  const keys: string[] = [];
  for (const name of ["Website", "Instagram", "LinkedIn"]) {
    const value = page.properties[name]?.url;
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      const url = new URL(value.trim().startsWith("http") ? value.trim() : `https://${value.trim()}`);
      const key = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
      if (key.includes(".")) keys.push(key);
    } catch {
      // An unparseable link is not an identity.
    }
  }
  return keys;
}

/**
 * One result per person. Same-name pages merge only when they also share a Website, Instagram or
 * LinkedIn; two different people who happen to share a name stay separate. The most recently
 * edited page is primary.
 */
export function mergeDuplicates(entries: IndexedEntry[]) {
  const byName = new Map<string, IndexedEntry[]>();
  for (const entry of entries) byName.set(nameKey(entry), [...(byName.get(nameKey(entry)) ?? []), entry]);
  const groups: IndexedEntry[][] = [];
  for (const sameName of byName.values()) {
    const parent = sameName.map((_, index) => index);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    sameName.forEach((a, i) =>
      sameName.forEach((b, j) => {
        if (j > i && a.identity?.some((key) => b.identity?.includes(key))) parent[find(j)] = find(i);
      }),
    );
    const clusters = new Map<number, IndexedEntry[]>();
    sameName.forEach((entry, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), entry]));
    groups.push(...clusters.values());
  }
  return groups.map((group) => {
    const [primary, ...rest] = [...group].sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
    const { identity: _identity, ...clean } = primary;
    void _identity;
    if (!rest.length) return clean;
    const projects = primary.projects.map((project) => ({ ...project, media: [...project.media], images: [...project.images] }));
    for (const other of rest)
      for (const project of other.projects) {
        const same = project.caption && projects.find((item) => item.caption === project.caption);
        if (same) {
          same.link ??= project.link;
          same.media = [...new Set([...same.media, ...project.media])];
          same.images.push(...project.images);
        } else projects.push({ ...project, idx: projects.length });
      }
    return {
      ...clean,
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
