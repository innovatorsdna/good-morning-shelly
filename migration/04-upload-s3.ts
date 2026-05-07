import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mime from "mime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
const REPORT_PATH = path.join(__dirname, "04-upload-s3-report.md");

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION ?? "us-east-1";
const KEY_PREFIX = process.env.S3_KEY_PREFIX ?? "uploads";
const CACHE_CONTROL =
  process.env.S3_CACHE_CONTROL ?? "public, max-age=31536000, immutable";
const CONCURRENCY = Number(process.env.S3_CONCURRENCY ?? 16);
const FORCE = process.env.S3_FORCE === "1";

if (!BUCKET) {
  console.error(
    "S3_BUCKET is required. Set it in .env or pass it on the command line:",
  );
  console.error("  S3_BUCKET=my-bucket pnpm migrate:upload-images");
  process.exit(1);
}
if (!fs.existsSync(UPLOADS_DIR)) {
  console.error(`No uploads directory at ${UPLOADS_DIR}.`);
  console.error("Run `pnpm migrate:images` first.");
  process.exit(1);
}

const client = new S3Client({ region: REGION });

interface Job {
  abs: string;
  key: string;
  size: number;
}

async function walk(dir: string, out: Job[] = []): Promise<Job[]> {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs, out);
    } else if (entry.isFile()) {
      const stat = await fsp.stat(abs);
      const rel = path.relative(UPLOADS_DIR, abs).split(path.sep).join("/");
      const key = KEY_PREFIX ? `${KEY_PREFIX}/${rel}` : rel;
      out.push({ abs, key, size: stat.size });
    }
  }
  return out;
}

async function existsAndMatches(
  key: string,
  size: number,
): Promise<boolean> {
  if (FORCE) return false;
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    return head.ContentLength === size;
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (
      err.name === "NotFound" ||
      err.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }
    throw e;
  }
}

async function uploadOne(job: Job): Promise<void> {
  const body = await fsp.readFile(job.abs);
  const contentType = mime.getType(job.abs) ?? "application/octet-stream";
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: job.key,
      Body: body,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    }),
  );
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
  console.log(`Scanning ${UPLOADS_DIR} ...`);
  const jobs = await walk(UPLOADS_DIR);
  const totalBytes = jobs.reduce((sum, j) => sum + j.size, 0);
  console.log(
    `Found ${jobs.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total`,
  );
  console.log(
    `Target: s3://${BUCKET}/${KEY_PREFIX ? KEY_PREFIX + "/" : ""}* in ${REGION}`,
  );
  console.log(`Concurrency: ${CONCURRENCY}, force re-upload: ${FORCE}`);
  console.log("");

  let completed = 0;
  let uploaded = 0;
  let skipped = 0;
  let bytesUploaded = 0;
  const failures: Array<{ key: string; error: string }> = [];
  const startedAt = Date.now();
  let lastLog = 0;

  await runPool(jobs, CONCURRENCY, async (job) => {
    try {
      if (await existsAndMatches(job.key, job.size)) {
        skipped++;
      } else {
        await uploadOne(job);
        uploaded++;
        bytesUploaded += job.size;
      }
    } catch (e) {
      failures.push({
        key: job.key,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    completed++;
    const now = Date.now();
    if (now - lastLog > 2000 || completed === jobs.length) {
      lastLog = now;
      const pct = ((completed / jobs.length) * 100).toFixed(1);
      const mb = (bytesUploaded / 1024 / 1024).toFixed(1);
      process.stdout.write(
        `\r  progress: ${completed}/${jobs.length} (${pct}%)  uploaded=${uploaded}  skipped=${skipped}  fail=${failures.length}  ${mb} MB sent   `,
      );
    }
  });
  process.stdout.write("\n");

  const lines: string[] = [];
  const push = (s = "") => lines.push(s);
  push("# Phase 6 — S3 upload report");
  push();
  push(`- Generated: ${new Date().toISOString()}`);
  push(`- Bucket: \`${BUCKET}\``);
  push(`- Region: ${REGION}`);
  push(`- Key prefix: \`${KEY_PREFIX || "(root)"}\``);
  push(`- Total files: ${jobs.length}`);
  push(`- Uploaded: ${uploaded}`);
  push(`- Skipped (already present): ${skipped}`);
  push(`- Failures: ${failures.length}`);
  push(`- Bytes sent this run: ${(bytesUploaded / 1024 / 1024).toFixed(1)} MB`);
  push(`- Duration: ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  push();
  if (failures.length > 0) {
    push("## Failures");
    push();
    push("| Key | Error |");
    push("| --- | --- |");
    for (const f of failures) {
      push(`| \`${f.key}\` | ${f.error.replace(/\|/g, "\\|")} |`);
    }
    push();
  }
  await fsp.writeFile(REPORT_PATH, lines.join("\n"));
  console.log(`Report: ${REPORT_PATH}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
