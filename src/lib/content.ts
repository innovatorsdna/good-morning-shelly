import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const PAGES_DIR = path.join(CONTENT_DIR, "pages");

export type Status = "publish" | "draft" | "private";

export interface ContentItem {
  type: "post" | "page";
  slug: string;
  title: string;
  date: string;
  modified?: string;
  status: Status;
  categories?: string[];
  cover?: string;
  excerpt?: string;
  sticky?: boolean;
  oldSlugs?: string[];
  wpId?: string;
  body: string;
  filePath: string;
}

// Most category slugs are clean kebab-case; these need explicit display names
// because title-casing the slug doesn't reproduce them correctly.
const CATEGORY_NAME_OVERRIDES: Record<string, string> = {
  "roena-studio": "Röena Studio",
  "swedendenmark-trip": "Sweden/Denmark Trip",
  "garden-of-gods-embrace": "Garden of God's Embrace",
  "swedish-unit-2": "Swedish Unit",
};

let cache: { all: ContentItem[]; byTypeSlug: Map<string, ContentItem> } | null = null;

function readDir(dir: string, type: "post" | "page"): ContentItem[] {
  if (!fs.existsSync(dir)) return [];
  const items: ContentItem[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".mdx")) continue;
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const fm = data as Record<string, unknown>;
    items.push({
      type,
      slug:
        typeof fm.slug === "string" ? fm.slug : file.replace(/\.mdx$/, ""),
      title: typeof fm.title === "string" ? fm.title : "",
      date: typeof fm.date === "string" ? fm.date : "",
      modified: typeof fm.modified === "string" ? fm.modified : undefined,
      status: (fm.status as Status) ?? "publish",
      categories: Array.isArray(fm.categories)
        ? (fm.categories as string[])
        : undefined,
      cover: typeof fm.cover === "string" ? fm.cover : undefined,
      excerpt: typeof fm.excerpt === "string" ? fm.excerpt : undefined,
      sticky: fm.sticky === true,
      oldSlugs: Array.isArray(fm.oldSlugs) ? (fm.oldSlugs as string[]) : undefined,
      wpId: typeof fm.wpId === "string" ? fm.wpId : undefined,
      body: content,
      filePath,
    });
  }
  return items;
}

function loadAll(): { all: ContentItem[]; byTypeSlug: Map<string, ContentItem> } {
  if (cache) return cache;
  const posts = readDir(POSTS_DIR, "post");
  const pages = readDir(PAGES_DIR, "page");
  const all = [...posts, ...pages];
  const byTypeSlug = new Map<string, ContentItem>();
  for (const it of all) byTypeSlug.set(`${it.type}:${it.slug}`, it);
  cache = { all, byTypeSlug };
  return cache;
}

export function getAllItems(): ContentItem[] {
  return loadAll().all;
}

export function getPublishedPosts(): ContentItem[] {
  return getAllItems()
    .filter((it) => it.type === "post" && it.status === "publish")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getAllPages(): ContentItem[] {
  return getAllItems().filter((it) => it.type === "page");
}

export function getItemBySlug(slug: string): ContentItem | null {
  const { byTypeSlug } = loadAll();
  // Prefer page over post (matches WordPress's flat-namespace resolution order)
  return (
    byTypeSlug.get(`page:${slug}`) ??
    byTypeSlug.get(`post:${slug}`) ??
    null
  );
}

export function getCategoryDisplayName(slug: string): string {
  if (CATEGORY_NAME_OVERRIDES[slug]) return CATEGORY_NAME_OVERRIDES[slug];
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPostsByCategory(slug: string): ContentItem[] {
  return getPublishedPosts().filter((p) => p.categories?.includes(slug));
}

export function getAllCategories(): Array<{ slug: string; name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of getPublishedPosts()) {
    for (const c of p.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({
      slug,
      name: getCategoryDisplayName(slug),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function formatPostDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.valueOf())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
