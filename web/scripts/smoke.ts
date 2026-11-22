/**
 * Production smoke test. Run after `npm run build`.
 *
 * Lesson (2026-11-22): a Vercel preview built fine and then 500'd on /explore because the page module
 * statically reached @huggingface/transformers, whose onnxruntime-node was not in the traced files, so the
 * module threw at load. Unit tests and the build cannot see that. This starts the real `next start` with a
 * small index built from the backup and asserts the owner pages answer without crashing, even when Notion
 * is unreachable (eligibility must then fail closed with 503, never 500).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const password = "smoke-test-password-123";
const auth = "Basic " + Buffer.from(`jonathan:${password}`).toString("base64");
const env = {
  ...process.env,
  VERCEL: "1",
  BLACKBOOK_OWNER_PASSWORD: password,
  BLACKBOOK_ALLOW_HTTP_LOOPBACK: "1",
  NOTION_API_KEY: "ntn_dummy_smoke_key",
  // Keep the sandbox's real Notion creds and proxies out of the picture: Notion must look unreachable.
  HTTPS_PROXY: "http://127.0.0.1:9",
  HTTP_PROXY: "http://127.0.0.1:9",
  https_proxy: "http://127.0.0.1:9",
  http_proxy: "http://127.0.0.1:9",
};

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/** Vercel ships only traced files, so what the build traced is what production can load. */
function checkTraces() {
  const traced = (file: string): string[] => JSON.parse(fs.readFileSync(path.join(".next/server/app", file), "utf8")).files;
  const explore = traced("explore/page.js.nft.json");
  check(!explore.some((f) => /@huggingface\/transformers|onnxruntime/.test(f)), "/explore trace does not pull the ONNX runtime");
  const search = traced("api/search/route.js.nft.json");
  for (const needle of [
    "onnxruntime-node/dist/index.js",
    "onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node",
    "onnxruntime-common/dist/",
    "transformers/dist/transformers.node.mjs",
  ])
    check(search.some((f) => f.includes(needle)), `/api/search trace includes ${needle}`);
  check(!search.some((f) => /napi-v6\/(darwin|win32)|napi-v6\/linux\/arm64/.test(f)), "/api/search trace excludes other platforms' ONNX binaries");
  check(!search.some((f) => /providers_(cuda|tensorrt)/.test(f)), "/api/search trace excludes the cuda and tensorrt providers");
  check(!search.some((f) => /sharp-(libvips-)?linuxmusl|sharp-wasm32/.test(f)), "/api/search trace excludes musl and wasm sharp");
}

/** Vercel's function limit is 250 MB unzipped; fail well before it. Sums every file each route's trace lists. */
const MAX_ROUTE_MB = 220;
function walkNft(dir: string, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkNft(full, out);
    else if (entry.name.endsWith(".nft.json")) out.push(full);
  }
  return out;
}
function checkRouteSizes() {
  for (const nft of walkNft(path.join(".next", "server")).sort()) {
    const seen = new Set<string>();
    let bytes = 0;
    for (const rel of JSON.parse(fs.readFileSync(nft, "utf8")).files as string[]) {
      const file = path.resolve(path.dirname(nft), rel);
      if (seen.has(file)) continue;
      seen.add(file);
      try {
        const stat = fs.statSync(file);
        if (stat.isFile()) bytes += stat.size;
      } catch {
        // Missing optional file: contributes nothing.
      }
    }
    const mb = bytes / 1024 / 1024;
    check(mb <= MAX_ROUTE_MB, `${path.relative(path.join(".next", "server"), nft)} traces ${mb.toFixed(1)} MB (limit ${MAX_ROUTE_MB})`);
  }
}

async function main() {
  if (!fs.existsSync(path.join(".next", "BUILD_ID"))) throw new Error("Run `npm run build` first.");
  checkTraces();
  checkRouteSizes();
  const built = spawnSync("npx", ["tsx", "scripts/build-index.ts", "--from-backup"], {
    env: { ...env, BLACKBOOK_BUILD_INDEX: "1" },
    encoding: "utf8",
  });
  if (built.status !== 0) throw new Error(`Index build failed: ${built.stdout}${built.stderr}`);
  // Pretend vectors exist so the query path really tries to load the embedding runtime (it must degrade).
  const indexFile = path.join(".blackbook-index", "index.json");
  const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  index.hasVectors = true;
  fs.writeFileSync(indexFile, JSON.stringify(index));

  const port = await freePort();
  const server = spawn("npx", ["next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      up = await fetch(base, { redirect: "manual" }).then(() => true, () => false);
      if (!up) await new Promise((r) => setTimeout(r, 500));
    }
    check(up, "server started");
    if (!up) throw new Error("server did not start");

    const unauth = await fetch(`${base}/explore`, { redirect: "manual" });
    check(unauth.status === 401 || unauth.status === 403, `/explore without credentials is refused (${unauth.status})`);

    const explore = await fetch(`${base}/explore`, { headers: { authorization: auth }, redirect: "manual" });
    const html = await explore.text();
    check(explore.status === 200, `/explore with credentials returns 200 (${explore.status})`);
    check(!html.includes("This page couldn"), "/explore does not render the error page");

    const search = await fetch(`${base}/api/search`, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ query: "brand identity designer" }),
    });
    const body = await search.text();
    check(search.status === 200 || search.status === 503, `/api/search returns 200 or 503, never 500 (${search.status})`);
    check(!body.includes("Search failed"), "/api/search did not hit its generic failure path");
  } finally {
    server.kill("SIGTERM");
  }
  if (failures.length) {
    console.error("Server log:\n" + log.slice(-3000));
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
