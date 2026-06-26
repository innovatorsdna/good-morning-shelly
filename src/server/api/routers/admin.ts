import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, like, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { slugify } from "~/lib/slug";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import type { db as dbType } from "~/server/db";
import {
  category as categoryTable,
  post as postTable,
  postCategory,
  postOldSlug,
} from "~/server/db/schema";
import { deleteMediaObject, listMediaObjects, presignUpload } from "~/server/s3";

// `status` is now purely the publish/draft lifecycle. Audience lives on the
// separate `isPrivate` flag; the legacy "private" status was migrated away.
const STATUSES = ["publish", "draft"] as const;
const TYPES = ["post", "page"] as const;

const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and dashes only.");

const upsertInput = z.object({
  type: z.enum(TYPES).default("post"),
  title: z.string().min(1).max(512),
  slug: slugSchema,
  status: z.enum(STATUSES).default("draft"),
  // Audience for posts: true = members-only, false = public. Forced to public
  // for pages (see create/update). Defaults to members-only.
  isPrivate: z.boolean().default(true),
  body: z.string().default(""),
  excerpt: z.string().max(500).optional().nullable(),
  cover: z.string().max(1024).optional().nullable(),
  sticky: z.boolean().default(false),
  categories: z.array(z.string().min(1).max(255)).default([]),
  publishedAt: z.coerce.date().optional().nullable(),
});

function revalidatePublicPaths(slugs: string[], categorySlugs: string[]): void {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/categories");
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");
  for (const s of slugs) {
    if (s) revalidatePath(`/${s}`);
  }
  for (const c of categorySlugs) {
    if (c) revalidatePath(`/category/${c}`);
  }
}

async function ensureCategories(db: typeof dbType, slugs: string[]) {
  if (slugs.length === 0) return;
  const rows = slugs.map((s) => ({
    slug: s,
    name: s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
  // onConflictDoNothing keeps existing display names intact.
  await db
    .insert(categoryTable)
    .values(rows)
    .onConflictDoNothing({ target: categoryTable.slug });
}

export const adminRouter = createTRPCRouter({
  recentEdits: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: postTable.id,
          slug: postTable.slug,
          title: postTable.title,
          status: postTable.status,
          source: postTable.source,
          type: postTable.type,
          updatedAt: postTable.updatedAt,
        })
        .from(postTable)
        .orderBy(desc(postTable.updatedAt))
        .limit(input.limit);
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const grouped = await ctx.db
      .select({
        type: postTable.type,
        status: postTable.status,
        c: count(),
      })
      .from(postTable)
      .groupBy(postTable.type, postTable.status);
    const counts: Record<string, number> = {};
    for (const r of grouped) counts[`${r.type}:${r.status}`] = r.c;
    const archived = await ctx.db
      .select({ c: count() })
      .from(postTable)
      .where(eq(postTable.source, "mdx"));
    return {
      counts,
      archived: archived[0]?.c ?? 0,
    };
  }),

  categories: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(categoryTable).orderBy(asc(categoryTable.slug));
  }),

  list: adminProcedure
    .input(
      z.object({
        type: z.enum(TYPES).default("post"),
        status: z.enum(STATUSES).optional(),
        q: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = and(
        eq(postTable.type, input.type),
        input.status ? eq(postTable.status, input.status) : undefined,
        input.q
          ? or(
              like(postTable.title, `%${input.q}%`),
              like(postTable.slug, `%${input.q}%`),
            )
          : undefined,
      );

      const totalRow = await ctx.db
        .select({ c: count() })
        .from(postTable)
        .where(where);
      const total = totalRow[0]?.c ?? 0;

      const rows = await ctx.db
        .select({
          id: postTable.id,
          slug: postTable.slug,
          title: postTable.title,
          status: postTable.status,
          isPrivate: postTable.isPrivate,
          source: postTable.source,
          publishedAt: postTable.publishedAt,
          updatedAt: postTable.updatedAt,
          type: postTable.type,
        })
        .from(postTable)
        .where(where)
        .orderBy(desc(postTable.publishedAt), desc(postTable.updatedAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return { rows, total };
    }),

  get: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(postTable)
        .where(eq(postTable.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const cats = await ctx.db
        .select({ slug: postCategory.categorySlug })
        .from(postCategory)
        .where(eq(postCategory.postId, row.id));
      return { ...row, categories: cats.map((c) => c.slug) };
    }),

  create: adminProcedure
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      const dup = await ctx.db
        .select({ id: postTable.id })
        .from(postTable)
        .where(eq(postTable.slug, input.slug))
        .limit(1);
      if (dup.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A post with that slug already exists.",
        });
      }
      const oldDup = await ctx.db
        .select({ slug: postOldSlug.slug })
        .from(postOldSlug)
        .where(eq(postOldSlug.slug, input.slug))
        .limit(1);
      if (oldDup.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug is reserved as a redirect from another post.",
        });
      }

      const publishedAt =
        input.publishedAt ?? (input.status === "publish" ? new Date() : null);

      const inserted = await ctx.db
        .insert(postTable)
        .values({
          slug: input.slug,
          type: input.type,
          source: "tiptap",
          title: input.title,
          body: input.body,
          excerpt: input.excerpt ?? null,
          cover: input.cover ?? null,
          status: input.status,
          // Pages are always public; only posts can be members-only.
          isPrivate: input.type === "page" ? false : input.isPrivate,
          sticky: input.sticky,
          authorId: ctx.session.user.id,
          publishedAt,
        })
        .returning({ id: postTable.id });
      const id = inserted[0]?.id;
      if (id == null) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.categories.length > 0) {
        await ensureCategories(ctx.db, input.categories);
        await ctx.db.insert(postCategory).values(
          input.categories.map((slug) => ({ postId: id, categorySlug: slug })),
        );
      }

      revalidatePublicPaths([input.slug], input.categories);
      return { id };
    }),

  update: adminProcedure
    .input(z.object({ id: z.number().int() }).merge(upsertInput))
    .mutation(async ({ ctx, input }) => {
      const existingRows = await ctx.db
        .select()
        .from(postTable)
        .where(eq(postTable.id, input.id))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.source === "mdx") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Archived MDX posts are read-only.",
        });
      }

      if (input.slug !== existing.slug) {
        const dup = await ctx.db
          .select({ id: postTable.id })
          .from(postTable)
          .where(and(eq(postTable.slug, input.slug), ne(postTable.id, input.id)))
          .limit(1);
        if (dup.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A post with that slug already exists.",
          });
        }
        await ctx.db
          .insert(postOldSlug)
          .values({ slug: existing.slug, postId: input.id })
          .onConflictDoNothing({ target: postOldSlug.slug });
      }

      const oldCatRows = await ctx.db
        .select({ slug: postCategory.categorySlug })
        .from(postCategory)
        .where(eq(postCategory.postId, input.id));
      const oldCats = oldCatRows.map((r) => r.slug);

      const publishedAt =
        input.publishedAt ??
        existing.publishedAt ??
        (input.status === "publish" ? new Date() : null);

      await ctx.db
        .update(postTable)
        .set({
          slug: input.slug,
          type: input.type,
          title: input.title,
          body: input.body,
          excerpt: input.excerpt ?? null,
          cover: input.cover ?? null,
          status: input.status,
          // Pages are always public; only posts can be members-only.
          isPrivate: input.type === "page" ? false : input.isPrivate,
          sticky: input.sticky,
          publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(postTable.id, input.id));

      await ctx.db
        .delete(postCategory)
        .where(eq(postCategory.postId, input.id));
      if (input.categories.length > 0) {
        await ensureCategories(ctx.db, input.categories);
        await ctx.db.insert(postCategory).values(
          input.categories.map((slug) => ({
            postId: input.id,
            categorySlug: slug,
          })),
        );
      }

      revalidatePublicPaths(
        [input.slug, existing.slug],
        Array.from(new Set([...oldCats, ...input.categories])),
      );
      return { id: input.id };
    }),

  autosave: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        body: z.string(),
        excerpt: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ source: postTable.source })
        .from(postTable)
        .where(eq(postTable.id, input.id))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (rows[0].source === "mdx") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db
        .update(postTable)
        .set({
          body: input.body,
          excerpt: input.excerpt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(postTable.id, input.id));
      return { savedAt: new Date().toISOString() };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(postTable)
        .where(eq(postTable.id, input.id))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.source === "mdx") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Archived MDX posts are read-only.",
        });
      }
      const cats = await ctx.db
        .select({ slug: postCategory.categorySlug })
        .from(postCategory)
        .where(eq(postCategory.postId, input.id));
      await ctx.db.delete(postTable).where(eq(postTable.id, input.id));
      revalidatePublicPaths([existing.slug], cats.map((c) => c.slug));
      return { id: input.id };
    }),

  /** Suggest a unique slug derived from `title`, avoiding collisions. */
  suggestSlug: adminProcedure
    .input(
      z.object({ title: z.string(), excludeId: z.number().int().optional() }),
    )
    .query(async ({ ctx, input }) => {
      const base = slugify(input.title) || "post";
      let candidate = base;
      for (let n = 2; n < 1000; n++) {
        const where = input.excludeId
          ? and(
              eq(postTable.slug, candidate),
              ne(postTable.id, input.excludeId),
            )
          : eq(postTable.slug, candidate);
        const dup = await ctx.db
          .select({ id: postTable.id })
          .from(postTable)
          .where(where)
          .limit(1);
        const dupOld = await ctx.db
          .select({ slug: postOldSlug.slug })
          .from(postOldSlug)
          .where(eq(postOldSlug.slug, candidate))
          .limit(1);
        if (dup.length === 0 && dupOld.length === 0) return { slug: candidate };
        candidate = `${base}-${n}`;
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }),

  presignUpload: adminProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z
          .string()
          .regex(/^[\w.+-]+\/[\w.+-]+$/)
          .max(100),
        size: z.number().int().min(1).max(20 * 1024 * 1024),
      }),
    )
    .mutation(async ({ input }) => {
      return presignUpload({
        filename: input.filename,
        contentType: input.contentType,
      });
    }),

  // ---------- Bulk actions ----------
  bulkUpdateStatus: adminProcedure
    .input(
      z.object({
        ids: z.array(z.number().int()).min(1).max(500),
        status: z.enum(STATUSES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: postTable.id,
          slug: postTable.slug,
          source: postTable.source,
        })
        .from(postTable)
        .where(inArray(postTable.id, input.ids));
      const editable = rows.filter((r) => r.source !== "mdx");
      if (editable.length === 0) {
        return { updated: 0, skipped: rows.length };
      }
      const editableIds = editable.map((r) => r.id);
      await ctx.db
        .update(postTable)
        .set({
          status: input.status,
          updatedAt: new Date(),
          ...(input.status === "publish" ? { publishedAt: new Date() } : {}),
        })
        .where(inArray(postTable.id, editableIds));

      const cats = await ctx.db
        .select({ slug: postCategory.categorySlug })
        .from(postCategory)
        .where(inArray(postCategory.postId, editableIds));
      revalidatePublicPaths(
        editable.map((r) => r.slug),
        cats.map((c) => c.slug),
      );
      return {
        updated: editable.length,
        skipped: rows.length - editable.length,
      };
    }),

  bulkSetVisibility: adminProcedure
    .input(
      z.object({
        ids: z.array(z.number().int()).min(1).max(500),
        isPrivate: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: postTable.id,
          slug: postTable.slug,
          source: postTable.source,
          type: postTable.type,
        })
        .from(postTable)
        .where(inArray(postTable.id, input.ids));
      // Archived MDX is read-only, and pages are always public.
      const editable = rows.filter(
        (r) => r.source !== "mdx" && r.type === "post",
      );
      if (editable.length === 0) {
        return { updated: 0, skipped: rows.length };
      }
      const editableIds = editable.map((r) => r.id);
      await ctx.db
        .update(postTable)
        .set({ isPrivate: input.isPrivate, updatedAt: new Date() })
        .where(inArray(postTable.id, editableIds));

      const cats = await ctx.db
        .select({ slug: postCategory.categorySlug })
        .from(postCategory)
        .where(inArray(postCategory.postId, editableIds));
      revalidatePublicPaths(
        editable.map((r) => r.slug),
        cats.map((c) => c.slug),
      );
      return {
        updated: editable.length,
        skipped: rows.length - editable.length,
      };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: postTable.id,
          slug: postTable.slug,
          source: postTable.source,
        })
        .from(postTable)
        .where(inArray(postTable.id, input.ids));
      const editable = rows.filter((r) => r.source !== "mdx");
      if (editable.length === 0) {
        return { deleted: 0, skipped: rows.length };
      }
      const editableIds = editable.map((r) => r.id);
      const cats = await ctx.db
        .select({ slug: postCategory.categorySlug })
        .from(postCategory)
        .where(inArray(postCategory.postId, editableIds));
      await ctx.db
        .delete(postTable)
        .where(inArray(postTable.id, editableIds));
      revalidatePublicPaths(
        editable.map((r) => r.slug),
        cats.map((c) => c.slug),
      );
      return {
        deleted: editable.length,
        skipped: rows.length - editable.length,
      };
    }),

  // ---------- Categories admin ----------
  /** Categories with usage counts. */
  categoriesWithCounts: adminProcedure.query(async ({ ctx }) => {
    const all = await ctx.db
      .select()
      .from(categoryTable)
      .orderBy(asc(categoryTable.slug));
    const counts = await ctx.db
      .select({ slug: postCategory.categorySlug, c: count() })
      .from(postCategory)
      .groupBy(postCategory.categorySlug);
    const countBySlug = new Map(counts.map((c) => [c.slug, c.c]));
    return all.map((c) => ({ ...c, count: countBySlug.get(c.slug) ?? 0 }));
  }),

  createCategory: adminProcedure
    .input(
      z.object({
        slug: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dup = await ctx.db
        .select({ slug: categoryTable.slug })
        .from(categoryTable)
        .where(eq(categoryTable.slug, input.slug))
        .limit(1);
      if (dup.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Category already exists.",
        });
      }
      await ctx.db.insert(categoryTable).values(input);
      return { slug: input.slug };
    }),

  renameCategory: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(categoryTable)
        .where(eq(categoryTable.slug, input.slug))
        .limit(1);
      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db
        .update(categoryTable)
        .set({ name: input.name })
        .where(eq(categoryTable.slug, input.slug));
      revalidatePublicPaths([], [input.slug]);
      return { slug: input.slug };
    }),

  deleteCategory: adminProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Cascade via foreign key (post_category.categorySlug -> category.slug).
      // Posts themselves are unaffected; they just lose this category.
      await ctx.db
        .delete(categoryTable)
        .where(eq(categoryTable.slug, input.slug));
      revalidatePublicPaths([], [input.slug]);
      return { slug: input.slug };
    }),

  /**
   * Move every post tagged `from` to instead use `to`, then delete `from`.
   * Both categories must already exist.
   */
  mergeCategory: adminProcedure
    .input(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.from === input.to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source and target are the same.",
        });
      }
      const both = await ctx.db
        .select()
        .from(categoryTable)
        .where(inArray(categoryTable.slug, [input.from, input.to]));
      if (both.length !== 2) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or both categories don't exist.",
        });
      }

      // Posts already linked to `to` shouldn't get duplicated when we move
      // the `from` link over. Find those and just delete the `from` link
      // for them.
      const conflicts = await ctx.db
        .select({ postId: postCategory.postId })
        .from(postCategory)
        .where(eq(postCategory.categorySlug, input.to));
      const conflictIds = new Set(conflicts.map((c) => c.postId));

      const fromLinks = await ctx.db
        .select({ postId: postCategory.postId })
        .from(postCategory)
        .where(eq(postCategory.categorySlug, input.from));

      const toReassign = fromLinks
        .map((l) => l.postId)
        .filter((id) => !conflictIds.has(id));

      // Drop `from` links entirely.
      await ctx.db
        .delete(postCategory)
        .where(eq(postCategory.categorySlug, input.from));

      // Insert `to` links for the non-conflict posts.
      if (toReassign.length > 0) {
        await ctx.db.insert(postCategory).values(
          toReassign.map((postId) => ({
            postId,
            categorySlug: input.to,
          })),
        );
      }

      // Delete the now-orphaned `from` category.
      await ctx.db
        .delete(categoryTable)
        .where(eq(categoryTable.slug, input.from));

      revalidatePublicPaths([], [input.from, input.to]);
      return { moved: toReassign.length };
    }),

  // ---------- Media library ----------
  listMedia: adminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      return listMediaObjects({
        continuationToken: input.cursor,
        limit: input.limit,
      });
    }),

  deleteMedia: adminProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await deleteMediaObject(input.key);
      return { key: input.key };
    }),
});
