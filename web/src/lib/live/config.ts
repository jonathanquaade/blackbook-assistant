import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { repoRoot } from "./paths";

export function liveSetting(name: string) {
  if (process.env[name] !== undefined) return process.env[name];
  try {
    return parseEnv(readFileSync(path.join(repoRoot(), ".env"), "utf8"))[name];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
