import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { visit, SKIP } from "unist-util-visit";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WXR_PATH = process.env.WXR_PATH ?? path.join(__dirname, "wxr.xml");
const MANIFEST_PATH = path.join(__dirname, "image-manifest.json");
const CONTENT_DIR = path.join(ROOT, "content");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const PAGES_DIR = path.join(CONTENT_DIR, "pages");
const REPORT_PATH = path.join(__dirname, "03-content-report.md");
const REDIRECTS_PATH = path.join(__dirname, "redirects.json");

const IMPORTABLE_TYPES = new Set(["post", "page"]);
const IMPORTABLE_STATUSES = new Set(["publish", "draft", "private"]);
const SELF_HOSTS = new Set([
  "goodmorningshelly.com",
  "www.goodmorningshelly.com",
]);

type AnyRecord = Record<string, unknown>;

interface ManifestEntry {
  ok: boolean;
  localPath?: string;
  source: string;
}

type Manifest = Record<string, ManifestEntry>;

interface NormalizedItem {
  id: string;
  type: "post" | "page";
  status: string;
  title: string;
  titleSource: "wxr" | "derived-from-content";
  slug: string;
  slugSource: "wxr" | "derived-from-title" | "deduped";
  date: string;
  dateSource: string;
  modified: string | null;
  categories: Array<{ slug: string; name: string }>;
  cover: string | null;
  excerpt: string;
  sticky: boolean;
  oldSlugs: string[];
  contentHtml: string;
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deriveTitleFromContent(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(/\s+/).slice(0, 8).join(" ");
  return words || "Untitled";
}

function parseDate(raw: string): Date | null {
  if (!raw || raw === "0000-00-00 00:00:00") return null;
  const v = raw.includes("T") || /\s\+\d{4}$|GMT/.test(raw)
    ? raw
    : raw.replace(" ", "T") + "Z";
  const d = new Date(v);
  return isNaN(d.valueOf()) ? null : d;
}

function pickDate(item: AnyRecord): { iso: string; source: string } | null {
  const candidates: Array<[string, string]> = [
    ["wp:post_date_gmt", asText(item["wp:post_date_gmt"])],
    ["wp:post_date", asText(item["wp:post_date"])],
    ["pubDate", asText(item.pubDate)],
    ["wp:post_modified_gmt", asText(item["wp:post_modified_gmt"])],
  ];
  for (const [src, val] of candidates) {
    const d = parseDate(val);
    if (d) return { iso: d.toISOString(), source: src };
  }
  return null;
}

function pickModified(item: AnyRecord): string | null {
  const d = parseDate(asText(item["wp:post_modified_gmt"]));
  return d ? d.toISOString() : null;
}

function isImportable(item: AnyRecord): boolean {
  const type = asText(item["wp:post_type"]);
  const status = asText(item["wp:status"]);
  if (!IMPORTABLE_TYPES.has(type) || !IMPORTABLE_STATUSES.has(status))
    return false;
  const title = asText(item.title).trim();
  const content = asText(item["content:encoded"]).trim();
  if (type === "page" && !content) return false;
  if (!title && !content) return false;
  return true;
}

function getMeta(
  item: AnyRecord,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of toArray<AnyRecord>(item["wp:postmeta"])) {
    const k = asText(m["wp:meta_key"]);
    const v = asText(m["wp:meta_value"]);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(v);
    map.set(k, arr);
  }
  return map;
}

function getCategories(
  item: AnyRecord,
): Array<{ slug: string; name: string }> {
  const out: Array<{ slug: string; name: string }> = [];
  const seen = new Set<string>();
  for (const c of toArray<AnyRecord>(item.category)) {
    if (c["@_domain"] !== "category") continue;
    const slug =
      typeof c["@_nicename"] === "string" ? c["@_nicename"] : "";
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name: asText(c) || slug });
  }
  return out;
}

function preCleanHtml(html: string): string {
  return (
    html
      // normalize line endings
      .replace(/\r\n/g, "\n")
      // collapse non-breaking spaces to regular spaces so they don't
      // get re-escaped as &#xA0; in the markdown output
      .replace(/ /g, " ")
      .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
      // strip WordPress [caption ...]...[/caption] shortcode wrappers, keep inner content
      .replace(/\[caption[^\]]*\]/gi, "")
      .replace(/\[\/caption\]/gi, "")
      // strip blogger-escaped attributes
      .replace(/\s+data-blogger-escaped-[a-z-]+="[^"]*"/gi, "")
      // strip inline style attributes (we don't preserve typography)
      .replace(/\s+style="[^"]*"/gi, "")
      // unwrap font/center tags
      .replace(/<\/?font[^>]*>/gi, "")
      .replace(/<center[^>]*>/gi, "")
      .replace(/<\/center>/gi, "")
      // empty paragraphs
      .replace(/<p[^>]*>\s*<\/p>/gi, "")
      // empty divs
      .replace(/<div[^>]*>\s*<\/div>/gi, "")
      // empty inline emphasis tags that would otherwise serialize as `__`
      .replace(/<em[^>]*>\s*<\/em>/gi, "")
      .replace(/<strong[^>]*>\s*<\/strong>/gi, "")
      .replace(/<i[^>]*>\s*<\/i>/gi, "")
      .replace(/<b[^>]*>\s*<\/b>/gi, "")
  );
}

function buildLookupMap(manifest: Manifest): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [url, entry] of Object.entries(manifest)) {
    if (!entry.ok || !entry.localPath) continue;
    lookup.set(url, entry.localPath);
    if (url.startsWith("https://")) {
      lookup.set("http://" + url.slice(8), entry.localPath);
    } else if (url.startsWith("http://")) {
      lookup.set("https://" + url.slice(7), entry.localPath);
    }
  }
  return lookup;
}

function rewriteUrlForImage(
  src: string,
  lookup: Map<string, string>,
): string {
  return lookup.get(src) ?? src;
}

function rewriteHref(href: string, lookup: Map<string, string>): string {
  if (!href || href.startsWith("#")) return href;
  if (href.startsWith("data:") || href.startsWith("mailto:")) return href;
  // Internal site links: strip the host so they become relative to the new site.
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return href;
  }
  if (SELF_HOSTS.has(u.hostname.toLowerCase())) {
    if (u.pathname.startsWith("/wp-content/uploads/")) {
      const local = lookup.get(href);
      if (local) return local;
      const altScheme = href.startsWith("https://")
        ? "http://" + href.slice(8)
        : href.startsWith("http://")
          ? "https://" + href.slice(7)
          : null;
      if (altScheme) {
        const local2 = lookup.get(altScheme);
        if (local2) return local2;
      }
      return u.pathname.replace(/^\/wp-content\/uploads\//, "/uploads/") +
        u.search +
        u.hash;
    }
    return u.pathname + u.search + u.hash;
  }
  // Off-site image URLs that we downloaded into uploads/legacy
  const local = lookup.get(href);
  if (local) return local;
  return href;
}

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

function hastTransform(lookup: Map<string, string>) {
  return (tree: unknown) => {
    visit(tree as HastNode, "element", (node, index, parent) => {
      const n = node as HastNode;
      // Strip remaining attributes that lint as junk
      if (n.properties) {
        for (const k of Object.keys(n.properties)) {
          if (k.startsWith("dataBlogger")) delete n.properties[k];
          if (k === "className") {
            const v = n.properties[k];
            const arr = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
            const filtered = arr.filter(
              (c) =>
                typeof c === "string" &&
                !c.startsWith("wp-") &&
                !c.startsWith("alignnone") &&
                !c.startsWith("aligncenter") &&
                !c.startsWith("alignleft") &&
                !c.startsWith("alignright") &&
                !c.startsWith("size-"),
            );
            if (filtered.length === 0) delete n.properties[k];
            else n.properties[k] = filtered;
          }
        }
      }

      // Rewrite img src/srcset
      if (n.tagName === "img" && n.properties) {
        const src = n.properties.src;
        if (typeof src === "string") {
          n.properties.src = rewriteUrlForImage(src, lookup);
        }
        // Drop srcset; markdown can't carry it and it complicates rewrites
        delete n.properties.srcSet;
        delete n.properties.srcset;
        // Drop dimensions and noise
        delete n.properties.width;
        delete n.properties.height;
        delete n.properties.border;
        delete n.properties.loading;
      }

      // Rewrite anchor hrefs
      if (n.tagName === "a" && n.properties) {
        const href = n.properties.href;
        if (typeof href === "string") {
          n.properties.href = rewriteHref(href, lookup);
        }
      }

      // Unwrap inline padding-only elements (NOT <div>: it carries block semantics
      // and rehype-remark needs it to produce paragraph breaks).
      if (
        (n.tagName === "span" || n.tagName === "font") &&
        parent &&
        typeof index === "number" &&
        Array.isArray((parent as HastNode).children)
      ) {
        const props = n.properties ?? {};
        const hasMeaningfulAttrs = typeof props.id === "string";
        if (!hasMeaningfulAttrs) {
          (parent as HastNode).children!.splice(
            index,
            1,
            ...(n.children ?? []),
          );
          return [SKIP, index];
        }
      }
    });
  };
}

async function htmlToMarkdown(
  html: string,
  lookup: Map<string, string>,
): Promise<string> {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(() => hastTransform(lookup))
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: "-",
      fences: true,
      incrementListMarker: false,
      rule: "-",
      emphasis: "_",
    })
    .process(html);
  return (
    String(file)
      // strip lines that are only emphasis markers (from empty <em>/<strong> after span unwrap)
      .replace(/^[\s_*]*[_*]{1,2}\s*[_*]{1,2}[\s_*]*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

function buildExcerpt(html: string, max = 200): string {
  const text = html
    // strip WP shortcodes and HTML
    .replace(/\[\/?[a-z][^\]]*\]/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 100 ? slice.slice(0, lastSpace) : slice) + "…";
}

function safeFilename(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 100);
}

async function main() {
  if (!fs.existsSync(WXR_PATH)) {
    console.error(`WXR file not found at ${WXR_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Image manifest not found at ${MANIFEST_PATH}`);
    console.error("Run `pnpm migrate:images` first.");
    process.exit(1);
  }

  console.log("Loading WXR...");
  const xml = fs.readFileSync(WXR_PATH, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml);
  const items = toArray<AnyRecord>(
    ((parsed as AnyRecord)?.rss as AnyRecord | undefined)?.channel != null
      ? (((parsed as AnyRecord).rss as AnyRecord).channel as AnyRecord).item
      : undefined,
  );
  console.log(`Found ${items.length} items in WXR`);

  console.log("Loading image manifest...");
  const manifest = JSON.parse(
    fs.readFileSync(MANIFEST_PATH, "utf-8"),
  ) as Manifest;
  const lookup = buildLookupMap(manifest);
  console.log(`Manifest entries: ${Object.keys(manifest).length}`);

  // Map attachment_id -> attachment URL, for resolving _thumbnail_id
  const attachmentById = new Map<string, string>();
  for (const item of items) {
    if (asText(item["wp:post_type"]) !== "attachment") continue;
    const id = asText(item["wp:post_id"]);
    const url = asText(item["wp:attachment_url"]);
    if (id && url) attachmentById.set(id, url);
  }

  // Pre-pass: collect every existing slug (for collision-safe derivation)
  const claimedSlugs = new Set<string>();
  for (const item of items) {
    if (!isImportable(item)) continue;
    const s = asText(item["wp:post_name"]);
    if (s) claimedSlugs.add(s);
  }

  function deriveUniqueSlug(base: string): string {
    const b = base || "untitled";
    if (!claimedSlugs.has(b)) {
      claimedSlugs.add(b);
      return b;
    }
    let n = 2;
    for (;;) {
      const candidate = `${b}-${n}`;
      if (!claimedSlugs.has(candidate)) {
        claimedSlugs.add(candidate);
        return candidate;
      }
      n++;
    }
  }

  // Build normalized items
  const normalized: NormalizedItem[] = [];
  const skipped: Array<{ id: string; type: string; reason: string }> = [];
  let derivedTitleCount = 0;
  let derivedSlugCount = 0;
  let dedupedSlugCount = 0;
  let missingDateCount = 0;

  for (const item of items) {
    const type = asText(item["wp:post_type"]);
    const status = asText(item["wp:status"]);
    const id = asText(item["wp:post_id"]);

    if (!IMPORTABLE_TYPES.has(type) || !IMPORTABLE_STATUSES.has(status)) {
      continue;
    }
    const rawTitle = asText(item.title).trim();
    const rawContent = asText(item["content:encoded"]);
    const trimmedContent = rawContent.trim();

    if (type === "page" && !trimmedContent) {
      skipped.push({ id, type, reason: "empty-page" });
      continue;
    }
    if (!rawTitle && !trimmedContent) {
      skipped.push({ id, type, reason: "no-title-no-content" });
      continue;
    }

    let title = rawTitle;
    let titleSource: NormalizedItem["titleSource"] = "wxr";
    if (!title) {
      title = deriveTitleFromContent(rawContent);
      titleSource = "derived-from-content";
      derivedTitleCount++;
    }

    let slug = asText(item["wp:post_name"]);
    let slugSource: NormalizedItem["slugSource"] = "wxr";
    if (!slug) {
      const base = slugify(title);
      const before = claimedSlugs.has(base);
      slug = deriveUniqueSlug(base);
      slugSource = before ? "deduped" : "derived-from-title";
      derivedSlugCount++;
      if (before) dedupedSlugCount++;
    }

    const dateInfo = pickDate(item);
    if (!dateInfo) missingDateCount++;
    const dateIso = dateInfo
      ? dateInfo.iso
      : new Date(0).toISOString();
    const dateSource = dateInfo ? dateInfo.source : "epoch-fallback";

    const meta = getMeta(item);
    const thumbId = meta.get("_thumbnail_id")?.[0];
    let cover: string | null = null;
    if (thumbId) {
      const attUrl = attachmentById.get(thumbId);
      if (attUrl) {
        const localFromManifest = lookup.get(attUrl);
        cover = localFromManifest ?? null;
      }
    }

    const oldSlugs = (meta.get("_wp_old_slug") ?? []).filter(Boolean);
    const sticky = asText(item["wp:is_sticky"]) === "1";
    const categories = getCategories(item);
    const excerpt = buildExcerpt(rawContent);
    const modified = pickModified(item);

    normalized.push({
      id,
      type: type as "post" | "page",
      status,
      title,
      titleSource,
      slug,
      slugSource,
      date: dateIso,
      dateSource,
      modified,
      categories,
      cover,
      excerpt,
      sticky,
      oldSlugs,
      contentHtml: rawContent,
    });
  }

  console.log(
    `Normalized ${normalized.length} items (skipped ${skipped.length})`,
  );

  await fsp.mkdir(POSTS_DIR, { recursive: true });
  await fsp.mkdir(PAGES_DIR, { recursive: true });

  let written = 0;
  const conversionFailures: Array<{ slug: string; error: string }> = [];
  const unresolvedImageRefs: Array<{ slug: string; src: string }> = [];

  for (const it of normalized) {
    let mdxBody: string;
    try {
      const cleaned = preCleanHtml(it.contentHtml);
      mdxBody = await htmlToMarkdown(cleaned, lookup);
    } catch (e) {
      conversionFailures.push({
        slug: it.slug,
        error: e instanceof Error ? e.message : String(e),
      });
      mdxBody = "";
    }

    // Track unresolved image refs (still pointing at goodmorningshelly.com or external)
    for (const m of mdxBody.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const src = m[1] ?? "";
      if (
        src.startsWith("http://") ||
        src.startsWith("https://")
      ) {
        unresolvedImageRefs.push({ slug: it.slug, src });
      }
    }

    const fm: Record<string, unknown> = {
      title: it.title,
      slug: it.slug,
      date: it.date,
      type: it.type,
      status: it.status,
    };
    if (it.modified && it.modified !== it.date) fm.modified = it.modified;
    if (it.categories.length > 0) {
      fm.categories = it.categories.map((c) => c.slug);
    }
    if (it.cover) fm.cover = it.cover;
    if (it.excerpt) fm.excerpt = it.excerpt;
    if (it.sticky) fm.sticky = true;
    if (it.titleSource !== "wxr") fm.titleSource = it.titleSource;
    if (it.slugSource !== "wxr") fm.slugSource = it.slugSource;
    if (it.oldSlugs.length > 0) fm.oldSlugs = it.oldSlugs;
    fm.wpId = it.id;

    const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
    const filename = safeFilename(it.slug) + ".mdx";
    const dir = it.type === "post" ? POSTS_DIR : PAGES_DIR;
    const file = path.join(dir, filename);
    const out = `---\n${yaml}\n---\n\n${mdxBody}`;
    await fsp.writeFile(file, out, "utf-8");
    written++;
  }

  // Build redirect map from _wp_old_slug
  const redirects: Array<{ from: string; to: string }> = [];
  for (const it of normalized) {
    for (const old of it.oldSlugs) {
      if (!old || old === it.slug) continue;
      redirects.push({ from: `/${old}/`, to: `/${it.slug}/` });
    }
  }
  await fsp.writeFile(REDIRECTS_PATH, JSON.stringify(redirects, null, 2));

  // Report
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);
  push("# Phase 3 — content conversion report");
  push();
  push(`- Generated: ${new Date().toISOString()}`);
  push(`- Items written: ${written} (${normalized.filter((n) => n.type === "post").length} posts, ${normalized.filter((n) => n.type === "page").length} pages)`);
  push(`- Items skipped: ${skipped.length}`);
  push(`- Titles derived from content: ${derivedTitleCount}`);
  push(`- Slugs derived from title: ${derivedSlugCount}`);
  push(`- Slugs deduped (collision suffix added): ${dedupedSlugCount}`);
  push(`- Items missing all date sources (used epoch fallback): ${missingDateCount}`);
  push(`- Conversion failures: ${conversionFailures.length}`);
  push(`- Image refs still remote (unresolved against manifest): ${unresolvedImageRefs.length}`);
  push(`- Redirects emitted (from _wp_old_slug): ${redirects.length}`);
  push();

  push("## Skip reasons");
  push();
  const skipByReason = new Map<string, number>();
  for (const s of skipped) {
    skipByReason.set(s.reason, (skipByReason.get(s.reason) ?? 0) + 1);
  }
  push("| Reason | Count |");
  push("| --- | ---: |");
  for (const [r, n] of skipByReason) push(`| ${r} | ${n} |`);
  push();

  if (derivedTitleCount > 0) {
    push("## Items with titles derived from content");
    push();
    push("| WP id | Slug | Derived title |");
    push("| --- | --- | --- |");
    for (const n of normalized.filter((x) => x.titleSource !== "wxr")) {
      push(`| ${n.id} | \`${n.slug}\` | ${n.title.replace(/\|/g, "\\|")} |`);
    }
    push();
  }

  if (derivedSlugCount > 0) {
    push("## Items with slugs derived from title");
    push();
    push("| WP id | Title | Slug | Source |");
    push("| --- | --- | --- | --- |");
    for (const n of normalized.filter((x) => x.slugSource !== "wxr")) {
      push(
        `| ${n.id} | ${n.title.replace(/\|/g, "\\|")} | \`${n.slug}\` | ${n.slugSource} |`,
      );
    }
    push();
  }

  if (conversionFailures.length > 0) {
    push("## Conversion failures");
    push();
    push("| Slug | Error |");
    push("| --- | --- |");
    for (const f of conversionFailures) {
      push(`| \`${f.slug}\` | ${f.error.replace(/\|/g, "\\|")} |`);
    }
    push();
  }

  if (unresolvedImageRefs.length > 0) {
    const uniqueByHost = new Map<string, number>();
    for (const r of unresolvedImageRefs) {
      let host = "(unparseable)";
      try {
        host = new URL(r.src).hostname;
      } catch {
        // fall through
      }
      uniqueByHost.set(host, (uniqueByHost.get(host) ?? 0) + 1);
    }
    push("## Unresolved image references");
    push();
    push("These survived the rewrite step (manifest miss). Per project rules, the broken `<img>` is left in place.");
    push();
    push("| Host | Count |");
    push("| --- | ---: |");
    for (const [h, n] of [...uniqueByHost.entries()].sort((a, b) => b[1] - a[1])) {
      push(`| \`${h}\` | ${n} |`);
    }
    push();
  }

  await fsp.writeFile(REPORT_PATH, lines.join("\n"));

  console.log(`Wrote ${written} MDX files`);
  console.log(`Report:    ${REPORT_PATH}`);
  console.log(`Redirects: ${REDIRECTS_PATH}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
