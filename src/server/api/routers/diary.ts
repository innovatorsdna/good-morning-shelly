import { TRPCError } from "@trpc/server";
import { asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { diaryComment, diaryPost } from "~/server/db/schema";
import { presignUpload } from "~/server/s3";

/**
 * Love Diary — a private, Instagram-style photo journal. Every procedure is an
 * `adminProcedure`, so the API is only reachable by signed-in admins (the same
 * guard the `/diary` route layout enforces in the UI).
 */
export const diaryRouter = createTRPCRouter({
  /** Newest-first feed, keyset-paginated on `createdAt`/`id`. */
  feed: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          // Cursor is the `id` of the last item from the previous page.
          cursor: z.number().int().optional(),
        })
        .default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.diaryPost.findMany({
        where: input.cursor ? lt(diaryPost.id, input.cursor) : undefined,
        orderBy: [desc(diaryPost.id)],
        limit: input.limit + 1,
        with: {
          author: { columns: { name: true, email: true, image: true } },
        },
      });

      let nextCursor: number | null = null;
      if (rows.length > input.limit) {
        const extra = rows.pop();
        nextCursor = extra ? rows[rows.length - 1]!.id : null;
      }

      // Attach a comment count per post in a single grouped query.
      const ids = rows.map((r) => r.id);
      const counts = ids.length
        ? await ctx.db
            .select({
              postId: diaryComment.postId,
              count: sql<number>`count(*)`.mapWith(Number),
            })
            .from(diaryComment)
            .where(inArray(diaryComment.postId, ids))
            .groupBy(diaryComment.postId)
        : [];
      const countByPost = new Map(counts.map((c) => [c.postId, c.count]));
      const posts = rows.map((r) => ({
        ...r,
        commentCount: countByPost.get(r.id) ?? 0,
      }));

      return { posts, nextCursor };
    }),

  /** Presign an S3 PUT for a diary photo. Mirrors `admin.presignUpload`. */
  presignUpload: adminProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z
          .string()
          .regex(/^[\w.+-]+\/[\w.+-]+$/)
          .max(100),
        size: z
          .number()
          .int()
          .min(1)
          .max(50 * 1024 * 1024),
      }),
    )
    .mutation(async ({ input }) => {
      return presignUpload({
        filename: input.filename,
        contentType: input.contentType,
      });
    }),

  /**
   * Create a diary entry. A post is a photo, a text-only message, or both —
   * at least one of `image`/`caption` must be present.
   */
  create: adminProcedure
    .input(
      z.object({
        image: z.string().min(1).max(1024).optional().nullable(),
        caption: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const caption = input.caption?.trim() ? input.caption.trim() : null;
      const image = input.image?.trim() ? input.image.trim() : null;
      if (!image && !caption) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add a photo or a message.",
        });
      }
      const inserted = await ctx.db
        .insert(diaryPost)
        .values({
          image,
          caption,
          authorId: ctx.session.user.id,
        })
        .returning({ id: diaryPost.id });
      const id = inserted[0]?.id;
      if (id == null) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id };
    }),

  /** Edit a diary entry's caption. Admins can edit any entry. */
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        caption: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: diaryPost.id })
        .from(diaryPost)
        .where(eq(diaryPost.id, input.id))
        .limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const caption = input.caption?.trim() ? input.caption.trim() : null;
      await ctx.db
        .update(diaryPost)
        .set({ caption })
        .where(eq(diaryPost.id, input.id));
      return { id: input.id, caption };
    }),

  /** Add a heart tap. Each call bumps the running like counter by one. */
  like: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(diaryPost)
        .set({ likes: sql`${diaryPost.likes} + 1` })
        .where(eq(diaryPost.id, input.id))
        .returning({ likes: diaryPost.likes });
      const likes = updated[0]?.likes;
      if (likes == null) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id, likes };
    }),

  /** Delete a diary entry. Admins can remove any entry. */
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: diaryPost.id })
        .from(diaryPost)
        .where(eq(diaryPost.id, input.id))
        .limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.delete(diaryPost).where(eq(diaryPost.id, input.id));
      return { id: input.id };
    }),

  /** Oldest-first comments for a single diary entry. */
  comments: adminProcedure
    .input(z.object({ postId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.diaryComment.findMany({
        where: eq(diaryComment.postId, input.postId),
        orderBy: [asc(diaryComment.createdAt), asc(diaryComment.id)],
        with: {
          author: { columns: { name: true, email: true, image: true } },
        },
      });
    }),

  /** Add a comment to a diary entry. */
  addComment: adminProcedure
    .input(
      z.object({
        postId: z.number().int(),
        body: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const body = input.body.trim();
      if (!body) throw new TRPCError({ code: "BAD_REQUEST" });
      const post = await ctx.db
        .select({ id: diaryPost.id })
        .from(diaryPost)
        .where(eq(diaryPost.id, input.postId))
        .limit(1);
      if (!post[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const inserted = await ctx.db
        .insert(diaryComment)
        .values({
          postId: input.postId,
          body,
          authorId: ctx.session.user.id,
        })
        .returning({ id: diaryComment.id });
      const id = inserted[0]?.id;
      if (id == null) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id };
    }),

  /** Delete a comment. Admins can remove any comment. */
  deleteComment: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: diaryComment.id })
        .from(diaryComment)
        .where(eq(diaryComment.id, input.id))
        .limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.delete(diaryComment).where(eq(diaryComment.id, input.id));
      return { id: input.id };
    }),
});
