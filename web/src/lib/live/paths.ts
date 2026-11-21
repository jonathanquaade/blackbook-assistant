import path from "node:path";

export function dataDir() {
  return process.env.BLACKBOOK_DATA_DIR ?? path.join(process.cwd(), ".data");
}
export const repoRoot = () =>
  process.env.BLACKBOOK_REPO_ROOT ?? path.resolve(process.cwd(), "..");
