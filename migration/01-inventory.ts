import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WXR_PATH = process.env.WXR_PATH ?? path.join(__dirname, "wxr.xml");
const REPORT_PATH = path.join(__dirname, "inventory-report.md");

const IMPORTABLE_TYPES = new Set(["post", "page"]);
const IMPORTABLE_STATUSES = new Set(["publish", "draft", "private"]);

if (!fs.existsSync(WXR_PATH)) {
  console.error(`Cannot find WXR file at ${WXR_PATH}.`);
  console.error("Set WXR_PATH or symlink/copy the export to migration/wxr.xml");
  process.exit(1);
}

console.log(`Reading ${WXR_PATH} ...`);
const xml = fs.readFileSync(WXR_PATH, "utf-8");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

console.log("Parsing XML ...");
const parsed = parser.parse(xml);

type AnyRecord = Record<string, unknown>;

const channel = (parsed?.rss?.channel ?? {}) as AnyRecord;
const items = toArray<AnyRecord>(channel.item);
console.log(`Found ${items.length} <item> entries`);

const postTypeCounts = new Map<string, number>();
const statusByType = new Map<string, Map<string, number>>();
const categoryCounts = new Map<string, { name: string; count: number }>();
const postmetaCounts = new Map<string, number>();
const slugMap = new Map<
  string,
  Array<{ type: string; status: string; id: string; title: string }>
>();
const importableNoSlug: Array<{ type: string; id: string; title: string }> = [];
const importableNoDate: Array<{ type: string; id: string; title: string }> = [];
const importableEmptyContent: Array<{
  type: string;
  id: string;
  title: string;
}> = [];
const imageHostCounts = new Map<string, number>();
let importableTotal = 0;

const IMG_RE = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;

for (const item of items) {
  const type = asText(item["wp:post_type"]);
  const status = asText(item["wp:status"]);
  const id = asText(item["wp:post_id"]);
  const slug = asText(item["wp:post_name"]);
  const dateGmt = asText(item["wp:post_date_gmt"]);
  const title = asText(item.title);
  const content = asText(item["content:encoded"]);

  postTypeCounts.set(type, (postTypeCounts.get(type) ?? 0) + 1);

  let perStatus = statusByType.get(type);
  if (!perStatus) {
    perStatus = new Map();
    statusByType.set(type, perStatus);
  }
  perStatus.set(status, (perStatus.get(status) ?? 0) + 1);

  const isImportable =
    IMPORTABLE_TYPES.has(type) && IMPORTABLE_STATUSES.has(status);
  if (!isImportable) continue;
  importableTotal += 1;

  for (const c of toArray<AnyRecord>(item.category)) {
    if (c["@_domain"] !== "category") continue;
    const nicename =
      typeof c["@_nicename"] === "string" ? c["@_nicename"] : "";
    if (!nicename) continue;
    const name = asText(c) || nicename;
    const existing = categoryCounts.get(nicename);
    if (existing) existing.count += 1;
    else categoryCounts.set(nicename, { name, count: 1 });
  }

  for (const m of toArray<AnyRecord>(item["wp:postmeta"])) {
    const key = asText(m["wp:meta_key"]);
    if (!key) continue;
    postmetaCounts.set(key, (postmetaCounts.get(key) ?? 0) + 1);
  }

  if (!slug) {
    importableNoSlug.push({ type, id, title });
  } else {
    const arr = slugMap.get(slug) ?? [];
    arr.push({ type, status, id, title });
    slugMap.set(slug, arr);
  }
  if (!dateGmt || dateGmt === "0000-00-00 00:00:00") {
    importableNoDate.push({ type, id, title });
  }
  if (!content.trim()) {
    importableEmptyContent.push({ type, id, title });
  }

  for (const m of content.matchAll(IMG_RE)) {
    const url = m[1];
    if (!url) continue;
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = "(invalid-url)";
    }
    imageHostCounts.set(host, (imageHostCounts.get(host) ?? 0) + 1);
  }
}

const collisions = [...slugMap.entries()].filter(
  ([, arr]) => arr.length > 1,
);

const lines: string[] = [];
const push = (s = "") => lines.push(s);

push("# WXR inventory report");
push();
push(`- Source: \`${WXR_PATH}\``);
push(`- Generated: ${new Date().toISOString()}`);
push(`- Total \`<item>\` entries: ${items.length}`);
push(`- Importable items (post/page in publish/draft/private): **${importableTotal}**`);
push();

push("## Post-type counts (all items)");
push();
push("| Type | Count |");
push("| --- | ---: |");
for (const [t, n] of sortByCountDesc(postTypeCounts)) {
  push(`| \`${t || "(empty)"}\` | ${n} |`);
}
push();

push("## Status by type");
push();
for (const [t, statuses] of [...statusByType.entries()].sort()) {
  push(`### \`${t || "(empty)"}\``);
  push();
  push("| Status | Count |");
  push("| --- | ---: |");
  for (const [s, n] of sortByCountDesc(statuses)) {
    push(`| \`${s || "(empty)"}\` | ${n} |`);
  }
  push();
}

push("## Slug collisions among importable items");
push();
if (collisions.length === 0) {
  push("_None._");
} else {
  push("| Slug | Items |");
  push("| --- | --- |");
  for (const [slug, arr] of collisions.sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    const detail = arr
      .map(
        (x) =>
          `${x.type}:${x.id} (${x.status}) "${escapePipe(x.title)}"`,
      )
      .join("<br>");
    push(`| \`${slug}\` | ${detail} |`);
  }
}
push();

push("## Importable items missing a slug");
push();
if (importableNoSlug.length === 0) {
  push("_None._");
} else {
  push(`Count: ${importableNoSlug.length}`);
  push();
  push("| Type | ID | Title |");
  push("| --- | --- | --- |");
  for (const { type, id, title } of importableNoSlug) {
    push(`| ${type} | ${id} | ${escapePipe(title) || "(no title)"} |`);
  }
}
push();

push("## Importable items missing post_date_gmt");
push();
if (importableNoDate.length === 0) {
  push("_None._");
} else {
  push(`Count: ${importableNoDate.length}`);
  push();
  push("| Type | ID | Title |");
  push("| --- | --- | --- |");
  for (const { type, id, title } of importableNoDate) {
    push(`| ${type} | ${id} | ${escapePipe(title) || "(no title)"} |`);
  }
}
push();

push("## Importable items with empty content");
push();
if (importableEmptyContent.length === 0) {
  push("_None._");
} else {
  push(`Count: ${importableEmptyContent.length}`);
  push();
  push("| Type | ID | Title |");
  push("| --- | --- | --- |");
  for (const { type, id, title } of importableEmptyContent) {
    push(`| ${type} | ${id} | ${escapePipe(title) || "(no title)"} |`);
  }
}
push();

push("## Categories used in importable items");
push();
push("| Slug | Name | Posts |");
push("| --- | --- | ---: |");
const sortedCats = [...categoryCounts.entries()].sort(
  (a, b) => b[1].count - a[1].count,
);
for (const [slug, info] of sortedCats) {
  push(`| \`${slug}\` | ${escapePipe(info.name)} | ${info.count} |`);
}
push();

push("## Image hostnames referenced by `<img src>` in importable content");
push();
push("| Host | `<img>` count |");
push("| --- | ---: |");
for (const [host, n] of sortByCountDesc(imageHostCounts)) {
  push(`| \`${host}\` | ${n} |`);
}
push();

push("## All `wp:postmeta` keys on importable items");
push();
push("| Key | Count |");
push("| --- | ---: |");
for (const [key, n] of sortByCountDesc(postmetaCounts)) {
  push(`| \`${key}\` | ${n} |`);
}
push();

fs.writeFileSync(REPORT_PATH, lines.join("\n"));
console.log(`Report written to ${REPORT_PATH}`);

// ---------- helpers ----------

function toArray<T>(v: unknown): T[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]) as T[];
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const t = (v as AnyRecord)["#text"];
    return typeof t === "string" ? t : "";
  }
  return "";
}

function sortByCountDesc(m: Map<string, number>): Array<[string, number]> {
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}
