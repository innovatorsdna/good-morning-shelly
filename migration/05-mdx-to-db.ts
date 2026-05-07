/**
 * Imports the MDX files in content/posts and content/pages into the
 * `post` / `category` / `post_category` tables.
 *
 * Imported rows are marked `source = "mdx"` and are treated as read-only
 * archives in the admin UI. New posts authored in the admin use
 * `source = "tiptap"`.
 *
 * Idempotent: running it twice will UPSERT by slug.
 *
 *   pnpm tsx migration/05-mdx-to-db.ts
 */
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { sql } from "drizzle-orm";

import { db } from "../src/server/db";
import {
  category as categoryTable,
  post as postTable,
  postCategory,
  postOldSlug,
} from "../src/server/db/schema";

const CONTENT_DIR = path.join(process.cwd(), "content");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const PAGES_DIR = path.join(CONTENT_DIR, "pages");

type Status = "publish" | "draft" | "private";

interface MdxItem {
  type: "post" | "page";
  slug: string;
  title: string;
  date: Date | null;
  modified: Date | null;
  status: Status;
  categories: string[];
  cover: string | null;
  excerpt: string | null;
  sticky: boolean;
  oldSlugs: string[];
  wpId: string | null;
  body: string;
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.valueOf()) ? null : d;
  }
  return null;
}

function readDir(dir: string, type: "post" | "page"): MdxItem[] {
  if (!fs.existsSync(dir)) return [];
  const items: MdxItem[] = [];
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
      date: asDate(fm.date),
      modified: asDate(fm.modified),
      status: (fm.status as Status) ?? "publish",
      categories: Array.isArray(fm.categories)
        ? (fm.categories as string[])
        : [],
      cover: typeof fm.cover === "string" ? fm.cover : null,
      excerpt: typeof fm.excerpt === "string" ? fm.excerpt : null,
      sticky: fm.sticky === true,
      oldSlugs: Array.isArray(fm.oldSlugs) ? (fm.oldSlugs as string[]) : [],
      wpId: typeof fm.wpId === "string" ? fm.wpId : null,
      body: content,
    });
  }
  return items;
}

function titleCase(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function run() {
  const posts = readDir(POSTS_DIR, "post");
  const pages = readDir(PAGES_DIR, "page");
  const all = [...posts, ...pages];

  console.log(`Found ${posts.length} posts and ${pages.length} pages.`);

  // Categories first (FK target).
  const categorySlugs = new Set<string>();
  for (const it of all) for (const c of it.categories) categorySlugs.add(c);
  if (categorySlugs.size > 0) {
    const rows = [...categorySlugs].map((slug) => ({
      slug,
      name: titleCase(slug),
    }));
    await db
      .insert(categoryTable)
      .values(rows)
      .onConflictDoNothing({ target: categoryTable.slug });
    console.log(`Upserted ${rows.length} categories.`);
  }

  // Posts.
  let imported = 0;
  for (const it of all) {
    const now = new Date();
    const inserted = await db
      .insert(postTable)
      .values({
        slug: it.slug,
        type: it.type,
        source: "mdx",
        title: it.title,
        body: it.body,
        excerpt: it.excerpt,
        cover: it.cover,
        status: it.status,
        sticky: it.sticky,
        wpId: it.wpId,
        publishedAt: it.date,
        createdAt: it.date ?? now,
        updatedAt: it.modified ?? it.date ?? now,
      })
      .onConflictDoUpdate({
        target: postTable.slug,
        set: {
          type: sql`excluded.type`,
          source: sql`excluded.source`,
          title: sql`excluded.title`,
          body: sql`excluded.body`,
          excerpt: sql`excluded.excerpt`,
          cover: sql`excluded.cover`,
          status: sql`excluded.status`,
          sticky: sql`excluded.sticky`,
          wpId: sql`excluded."wpId"`,
          publishedAt: sql`excluded."publishedAt"`,
          updatedAt: sql`excluded."updatedAt"`,
        },
      })
      .returning({ id: postTable.id });

    const postId = inserted[0]?.id;
    if (postId == null) throw new Error(`No id returned for ${it.slug}`);

    // Replace category links.
    await db.delete(postCategory).where(sql`${postCategory.postId} = ${postId}`);
    if (it.categories.length > 0) {
      await db.insert(postCategory).values(
        it.categories.map((slug) => ({ postId, categorySlug: slug })),
      );
    }

    // Replace old slugs.
    await db.delete(postOldSlug).where(sql`${postOldSlug.postId} = ${postId}`);
    if (it.oldSlugs.length > 0) {
      await db
        .insert(postOldSlug)
        .values(it.oldSlugs.map((slug) => ({ slug, postId })))
        .onConflictDoNothing({ target: postOldSlug.slug });
    }

    imported++;
    if (imported % 50 === 0) console.log(`  ...${imported}/${all.length}`);
  }

  console.log(`Imported ${imported} items.`);
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
