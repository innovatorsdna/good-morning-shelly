import { TRPCError } from "@trpc/server";
import { desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { diaryPost } from "~/server/db/schema";
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

      return { posts: rows, nextCursor };
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
        size: z.number().int().min(1).max(20 * 1024 * 1024),
      }),
    )
    .mutation(async ({ input }) => {
      return presignUpload({
        filename: input.filename,
        contentType: input.contentType,
      });
    }),

  /** Create a diary entry from an already-uploaded image path + caption. */
  create: adminProcedure
    .input(
      z.object({
        image: z.string().min(1).max(1024),
        caption: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const caption = input.caption?.trim() ? input.caption.trim() : null;
      const inserted = await ctx.db
        .insert(diaryPost)
        .values({
          image: input.image,
          caption,
          authorId: ctx.session.user.id,
        })
        .returning({ id: diaryPost.id });
      const id = inserted[0]?.id;
      if (id == null) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id };
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
});
