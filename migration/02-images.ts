import { XMLParser } from "fast-xml-parser";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WXR_PATH = process.env.WXR_PATH ?? path.join(__dirname, "wxr.xml");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const LEGACY_DIR = path.join(UPLOADS_DIR, "legacy");
const MANIFEST_PATH = path.join(__dirname, "image-manifest.json");
const REPORT_PATH = path.join(__dirname, "02-images-report.md");

const CONCURRENCY = 12;
const TIMEOUT_MS = 90_000;
const USER_AGENT = "Mozilla/5.0 (compatible; gms-migration/1.0)";

const IMPORTABLE_TYPES = new Set(["post", "page"]);
const IMPORTABLE_STATUSES = new Set(["publish", "draft", "private"]);
const SELF_HOSTS = new Set([
  "goodmorningshelly.com",
  "www.goodmorningshelly.com",
]);
const SKIP_HOSTS = new Set(["mail.google.com"]);

type AnyRecord = Record<string, unknown>;
type JobSource = "attachment" | "content-self" | "content-legacy";

interface Job {
  url: string;
  destAbs: string;
  destPublic: string;
  source: JobSource;
}

interface ManifestEntry {
  ok: boolean;
  localPath?: string;
  bytes?: number;
  status?: number;
  error?: string;
  source: JobSource;
}

function toArray<T>(v: unknown): T[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]) as T[];
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const t = (v as AnyRecord)["#text"];
    return typeof t === "string" ? t : "";
  }
  return "";
}

function isImportable(item: AnyRecord): boolean {
  const type = asText(item["wp:post_type"]);
  const status = asText(item["wp:status"]);
  if (!IMPORTABLE_TYPES.has(type) || !IMPORTABLE_STATUSES.has(status))
    return false;
  const title = asText(item.title).trim();
  const content = asText(item["content:encoded"]).trim();
  // Skip the 28 empty category landing pages
  if (type === "page" && !content) return false;
  // Skip no-title autosave drafts that also have no content
  if (!title && !content) return false;
  return true;
}

function pathForSelfHostedUrl(
  url: string,
): { destAbs: string; destPublic: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const decoded = decodeURIComponent(u.pathname);
  const m = /\/wp-content\/uploads\/(.+)$/.exec(decoded);
  if (!m?.[1]) return null;
  const sub = m[1];
  return {
    destAbs: path.join(UPLOADS_DIR, sub),
    destPublic: `/uploads/${sub}`,
  };
}

function pathForLegacyUrl(
  url: string,
): { destAbs: string; destPublic: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const baseFile =
    decodeURIComponent(path.basename(u.pathname || "")) || "image";
  const cleanFile =
    baseFile.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "image";
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
  const filename = `${hash}-${cleanFile}`;
  return {
    destAbs: path.join(LEGACY_DIR, filename),
    destPublic: `/uploads/legacy/${filename}`,
  };
}

async function downloadOne(
  url: string,
  destAbs: string,
): Promise<
  { ok: true; bytes: number } | { ok: false; status?: number; error: string }
> {
  try {
    const stat = await fsp.stat(destAbs);
    if (stat.size > 0) return { ok: true, bytes: stat.size };
  } catch {
    // not present, proceed
  }

  await fsp.mkdir(path.dirname(destAbs), { recursive: true });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fsp.writeFile(destAbs, buf);
    return { ok: true, bytes: buf.byteLength };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool<T>(
  jobs: T[],
  concurrency: number,
  worker: (j: T, i: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= jobs.length) return;
      const job = jobs[idx];
      if (!job) return;
      await worker(job, idx);
    }
  });
  await Promise.all(workers);
}

async function main() {
  if (!fs.existsSync(WXR_PATH)) {
    console.error(`Cannot find WXR file at ${WXR_PATH}`);
    process.exit(1);
  }

  console.log(`Reading ${WXR_PATH} ...`);
  const xml = fs.readFileSync(WXR_PATH, "utf-8");

  console.log("Parsing XML ...");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml);
  const items = toArray<AnyRecord>(
    (parsed as AnyRecord)?.rss != null
      ? ((parsed as AnyRecord).rss as AnyRecord)?.channel != null
        ? (((parsed as AnyRecord).rss as AnyRecord).channel as AnyRecord).item
        : undefined
      : undefined,
  );

  const jobMap = new Map<string, Job>();

  // 1. WP attachments
  for (const item of items) {
    if (asText(item["wp:post_type"]) !== "attachment") continue;
    const url = asText(item["wp:attachment_url"]);
    if (!url) continue;
    if (jobMap.has(url)) continue;
    const sp = pathForSelfHostedUrl(url);
    if (!sp) continue;
    jobMap.set(url, {
      url,
      destAbs: sp.destAbs,
      destPublic: sp.destPublic,
      source: "attachment",
    });
  }

  // 2. Importable item content
  const IMG_RE = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  let importableSeen = 0;
  for (const item of items) {
    if (!isImportable(item)) continue;
    importableSeen++;
    const content = asText(item["content:encoded"]);
    for (const m of content.matchAll(IMG_RE)) {
      const rawUrl = m[1];
      if (!rawUrl) continue;
      if (rawUrl.startsWith("data:")) continue;
      if (!/^https?:/i.test(rawUrl)) continue;
      let host: string;
      try {
        host = new URL(rawUrl).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (SKIP_HOSTS.has(host)) continue;
      if (jobMap.has(rawUrl)) continue;
      if (SELF_HOSTS.has(host)) {
        const sp = pathForSelfHostedUrl(rawUrl);
        if (sp) {
          jobMap.set(rawUrl, {
            url: rawUrl,
            destAbs: sp.destAbs,
            destPublic: sp.destPublic,
            source: "content-self",
          });
        }
      } else {
        const lp = pathForLegacyUrl(rawUrl);
        if (lp) {
          jobMap.set(rawUrl, {
            url: rawUrl,
            destAbs: lp.destAbs,
            destPublic: lp.destPublic,
            source: "content-legacy",
          });
        }
      }
    }
  }

  const jobs = [...jobMap.values()];
  const counts = {
    attachment: jobs.filter((j) => j.source === "attachment").length,
    contentSelf: jobs.filter((j) => j.source === "content-self").length,
    contentLegacy: jobs.filter((j) => j.source === "content-legacy").length,
  };

  console.log(`Importable items scanned: ${importableSeen}`);
  console.log(`Total unique URLs to download: ${jobs.length}`);
  console.log(`  attachments:      ${counts.attachment}`);
  console.log(`  content (self):   ${counts.contentSelf}`);
  console.log(`  content (legacy): ${counts.contentLegacy}`);
  console.log("");

  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  await fsp.mkdir(LEGACY_DIR, { recursive: true });

  const manifest: Record<string, ManifestEntry> = {};
  let completed = 0;
  let okCount = 0;
  let bytes = 0;
  const failures: Array<{
    url: string;
    status?: number;
    error: string;
    source: JobSource;
  }> = [];

  const startedAt = Date.now();
  let lastLog = 0;

  await runPool(jobs, CONCURRENCY, async (job) => {
    const result = await downloadOne(job.url, job.destAbs);
    completed++;
    if (result.ok) {
      okCount++;
      bytes += result.bytes;
      manifest[job.url] = {
        ok: true,
        localPath: job.destPublic,
        bytes: result.bytes,
        source: job.source,
      };
    } else {
      manifest[job.url] = {
        ok: false,
        status: result.status,
        error: result.error,
        source: job.source,
      };
      failures.push({
        url: job.url,
        status: result.status,
        error: result.error,
        source: job.source,
      });
    }
    const now = Date.now();
    if (now - lastLog > 2000 || completed === jobs.length) {
      lastLog = now;
      const pct = ((completed / jobs.length) * 100).toFixed(1);
      const mb = (bytes / 1024 / 1024).toFixed(1);
      process.stdout.write(
        `\r  progress: ${completed}/${jobs.length} (${pct}%)  ok=${okCount}  fail=${failures.length}  ${mb} MB downloaded   `,
      );
    }
  });
  process.stdout.write("\n");

  await fsp.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const report: string[] = [];
  const push = (s = "") => report.push(s);
  push("# Phase 2 — image sync report");
  push();
  push(`- Generated: ${new Date().toISOString()}`);
  push(`- Total unique URLs: ${jobs.length}`);
  push(`- Successful downloads: ${okCount}`);
  push(`- Failures: ${failures.length}`);
  push(`- Bytes written: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  push(`- Duration: ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  push();
  push("## Source breakdown");
  push();
  push("| Source | Count |");
  push("| --- | ---: |");
  push(`| WP attachments | ${counts.attachment} |`);
  push(`| Self-hosted in content | ${counts.contentSelf} |`);
  push(`| Off-site in content | ${counts.contentLegacy} |`);
  push();
  push(`## Failures (${failures.length})`);
  push();
  if (failures.length === 0) {
    push("_None._");
  } else {
    const byHost = new Map<string, number>();
    for (const f of failures) {
      let host = "(unknown)";
      try {
        host = new URL(f.url).hostname;
      } catch {
        // keep default
      }
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
    }
    push("### By host");
    push();
    push("| Host | Failures |");
    push("| --- | ---: |");
    for (const [h, n] of [...byHost.entries()].sort((a, b) => b[1] - a[1])) {
      push(`| \`${h}\` | ${n} |`);
    }
    push();
    push("### Full list");
    push();
    push("| Source | Status | Error | URL |");
    push("| --- | --- | --- | --- |");
    for (const f of failures) {
      push(
        `| ${f.source} | ${f.status ?? ""} | ${f.error.replace(/\|/g, "\\|")} | ${f.url} |`,
      );
    }
  }
  push();
  await fsp.writeFile(REPORT_PATH, report.join("\n"));
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Report:   ${REPORT_PATH}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
