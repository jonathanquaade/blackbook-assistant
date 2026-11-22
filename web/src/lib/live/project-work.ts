import type { IndexedProject } from "./projection";

export function hasSelectedWork(project: Pick<IndexedProject, "link" | "media" | "images" | "contextShot">) {
  return !project.contextShot && Boolean(project.link || project.media.length || project.images.length);
}
