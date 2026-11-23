import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./paths";

// Last-good sync pointer for the self-hosted path (kept apart from PGlite so serverless never loads it).
export interface SyncStatus {
  lastAttempt?: { at: string; ok: boolean; source: string; error?: string };
  lastGood?: { at: string; source: string; dir: string; eligible: number; merged: number; embedded: number; reused: number };
}
const statusFile = () => path.join(dataDir(), "sync-status.json");
export function readStatus(): SyncStatus {
  try {
    return JSON.parse(fs.readFileSync(statusFile(), "utf8"));
  } catch {
    return {};
  }
}
export function writeStatus(status: SyncStatus) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(`${statusFile()}.tmp`, JSON.stringify(status, null, 2));
  fs.renameSync(`${statusFile()}.tmp`, statusFile());
}

