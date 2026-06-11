import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  category as categoryTable,
  post as postTable,
  postCategory,
} from "~/server/db/schema";

export type Status = "publish" | "draft" | "private";
export type ContentType = "post" | "page";
export type ContentSource = "mdx" | "tiptap";

export interface ContentItem {
  id: number;
  type: ContentType;
  source: ContentSource;
  slug: string;
  title: string;
  /** ISO 8601 publish date. Empty string when not yet published. */
  date: string;
  /** ISO 8601 last-modified timestamp. */
  modified?: string;
  status: Status;
  categories?: string[];
  cover?: string;
  excerpt?: string;
  sticky?: boolean;
  oldSlugs?: string[];
  wpId?: string;
  body: string;
}

const CATEGORY_NAME_OVERRIDES: Record<string, string> = {
  "roena-studio": "Röena Studio",
  "swedendenmark-trip": "Sweden/Denmark Trip",
  "garden-of-gods-embrace": "Garden of God's Embrace",
  "swedish-unit-2": "Swedish Unit",
};

function toIsoString(d: Date | null | undefined): string {
  return d ? d.toISOString() : "";
}

interface PostRow {
  id: number;
  slug: string;
  type: string;
  source: string;
  title: string;
  body: string;
  excerpt: string | null;
  cover: string | null;
  status: string;
  sticky: boolean;
  wpId: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  createdAt: Date;
}

function rowToItem(
  row: PostRow,
  categoriesByPost: Map<number, string[]>,
): ContentItem {
  return {
    id: row.id,
    type: row.type === "page" ? "page" : "post",
    source: row.source === "mdx" ? "mdx" : "tiptap",
    slug: row.slug,
    title: row.title,
    date: toIsoString(row.publishedAt),
    modified: toIsoString(row.updatedAt) || undefined,
    status: (row.status as Status) ?? "draft",
    categories: categoriesByPost.get(row.id),
    cover: row.cover ?? undefined,
    excerpt: row.excerpt ?? undefined,
    sticky: row.sticky,
    wpId: row.wpId ?? undefined,
    body: row.body,
  };
}

async function loadCategoriesFor(
  postIds: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (postIds.length === 0) return map;
  const rows = await db
    .select()
    .from(postCategory)
    .where(inArray(postCategory.postId, postIds));
  for (const r of rows) {
    const arr = map.get(r.postId) ?? [];
    arr.push(r.categorySlug);
    map.set(r.postId, arr);
  }
  return map;
}

export async function getAllItems(): Promise<ContentItem[]> {
  const rows = await db
    .select()
    .from(postTable)
    .orderBy(desc(postTable.publishedAt));
  const cats = await loadCategoriesFor(rows.map((r) => r.id));
  return rows.map((r) => rowToItem(r, cats));
}

export async function getPublishedPosts(): Promise<ContentItem[]> {
  const rows = await db
    .select()
    .from(postTable)
    .where(eq(postTable.type, "post"))
    .orderBy(desc(postTable.publishedAt));
  const published = rows.filter((r) => r.status === "publish");
  const cats = await loadCategoriesFor(published.map((r) => r.id));
  return published.map((r) => rowToItem(r, cats));
}

export interface SearchOptions {
  /** Free-text query matched against title and body (case-insensitive). */
  query?: string;
  /** Inclusive lower bound on publish date, as `YYYY-MM-DD`. */
  from?: string;
  /** Inclusive upper bound on publish date, as `YYYY-MM-DD`. */
  to?: string;
}

/** Parse a `YYYY-MM-DD` string into a Date, or null if invalid/empty. */
function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.valueOf()) ? null : d;
}

/**
 * Search published posts by title and body, optionally constrained to a
 * publish-date range. Results are ordered newest-first. Returns an empty array
 * when no query and no date bounds are supplied.
 */
export async function searchPosts(opts: SearchOptions): Promise<ContentItem[]> {
  const query = opts.query?.trim() ?? "";
  const from = parseDateInput(opts.from);
  const to = parseDateInput(opts.to);
  if (!query && !from && !to) return [];

  const conditions = [
    eq(postTable.type, "post"),
    eq(postTable.status, "publish"),
  ];

  if (query) {
    // SQLite LIKE is case-insensitive for ASCII; lower() covers the rest.
    const term = `%${query.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${postTable.title}) like ${term} or lower(${postTable.body}) like ${term})`,
    );
  }
  if (from) {
    conditions.push(gte(postTable.publishedAt, from));
  }
  if (to) {
    // Include the whole `to` day rather than cutting off at midnight.
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(postTable.publishedAt, end));
  }

  const rows = await db
    .select()
    .from(postTable)
    .where(and(...conditions))
    .orderBy(desc(postTable.publishedAt));
  const cats = await loadCategoriesFor(rows.map((r) => r.id));
  return rows.map((r) => rowToItem(r, cats));
}

export async function getAllPages(): Promise<ContentItem[]> {
  const rows = await db
    .select()
    .from(postTable)
    .where(eq(postTable.type, "page"));
  const cats = await loadCategoriesFor(rows.map((r) => r.id));
  return rows.map((r) => rowToItem(r, cats));
}

export async function getItemBySlug(slug: string): Promise<ContentItem | null> {
  const direct = await db
    .select()
    .from(postTable)
    .where(eq(postTable.slug, slug))
    .limit(1);
  // Match the original WordPress resolution order: page wins over post when
  // both exist with the same slug.
  const sorted = direct.sort((a, b) =>
    a.type === b.type ? 0 : a.type === "page" ? -1 : 1,
  );
  const row = sorted[0];
  if (!row) return null;
  const cats = await loadCategoriesFor([row.id]);
  return rowToItem(row, cats);
}

export function getCategoryDisplayName(slug: string): string {
  if (CATEGORY_NAME_OVERRIDES[slug]) return CATEGORY_NAME_OVERRIDES[slug];
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getPostsByCategory(slug: string): Promise<ContentItem[]> {
  const rows = await db
    .select({ post: postTable })
    .from(postCategory)
    .innerJoin(postTable, eq(postCategory.postId, postTable.id))
    .where(eq(postCategory.categorySlug, slug))
    .orderBy(desc(postTable.publishedAt));
  const published = rows
    .map((r) => r.post)
    .filter((r) => r.type === "post" && r.status === "publish");
  const cats = await loadCategoriesFor(published.map((r) => r.id));
  return published.map((r) => rowToItem(r, cats));
}

export async function getAllCategories(): Promise<
  Array<{ slug: string; name: string; count: number }>
> {
  const rows = await db
    .select({
      slug: postCategory.categorySlug,
      status: postTable.status,
      type: postTable.type,
    })
    .from(postCategory)
    .innerJoin(postTable, eq(postCategory.postId, postTable.id));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== "post" || r.status !== "publish") continue;
    counts.set(r.slug, (counts.get(r.slug) ?? 0) + 1);
  }
  // Pull display names from the category table where present.
  const named = await db
    .select()
    .from(categoryTable)
    .orderBy(asc(categoryTable.slug));
  const nameBySlug = new Map(named.map((c) => [c.slug, c.name]));
  return [...counts.entries()]
    .map(([slug, count]) => ({
      slug,
      name: nameBySlug.get(slug) ?? getCategoryDisplayName(slug),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export { formatPostDate } from "~/lib/format";
