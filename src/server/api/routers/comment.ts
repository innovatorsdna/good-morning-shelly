import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import {
  checkAkismet,
  clientIpFrom,
  hashIp,
  verifyTurnstile,
} from "~/server/comments/spam";
import {
  blockedIp as blockedIpTable,
  comment as commentTable,
  post as postTable,
  user as userTable,
} from "~/server/db/schema";

// Rate limit: at most this many comments from one IP within the window.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
// Bots typically submit instantly; a human takes at least a couple seconds.
const MIN_FILL_MS = 2000;

const createInput = z.object({
  postId: z.number().int().positive(),
  parentId: z.number().int().positive().optional(),
  body: z.string().trim().min(1, "Comment can't be empty.").max(5000),
  guestName: z.string().trim().min(2).max(80).optional(),
  guestEmail: z.string().trim().email().max(255).optional(),
  // Cloudflare Turnstile token (required for anonymous comments when configured).
  turnstileToken: z.string().optional(),
  // Honeypot: a hidden field real users never fill in.
  website: z.string().optional(),
  // Milliseconds the form was on screen before submit (bot-timing heuristic).
  elapsedMs: z.number().int().nonnegative().optional(),
});

export const commentRouter = createTRPCRouter({
  /** Public, approved comments for a post (flat; the client nests replies). */
  list: publicProcedure
    .input(z.object({ postId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: commentTable.id,
          parentId: commentTable.parentId,
          body: commentTable.body,
          createdAt: commentTable.createdAt,
          guestName: commentTable.guestName,
          userName: userTable.name,
          userImage: userTable.image,
        })
        .from(commentTable)
        .leftJoin(userTable, eq(commentTable.userId, userTable.id))
        .where(
          and(
            eq(commentTable.postId, input.postId),
            eq(commentTable.status, "approved"),
          ),
        )
        .orderBy(asc(commentTable.createdAt));

      return rows.map((r) => ({
        id: r.id,
        parentId: r.parentId,
        body: r.body,
        createdAt: r.createdAt,
        authorName: r.userName ?? r.guestName ?? "Anonymous",
        authorImage: r.userImage ?? null,
        registered: r.userName != null,
      }));
    }),

  /**
   * Submit a comment. Works for signed-in users and anonymous guests.
   * Runs the spam/bot pipeline before persisting.
   */
  create: publicProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session?.user;

      // 1. Honeypot — a filled hidden field means a bot. Pretend success so we
      //    don't teach the bot to adapt, but persist nothing.
      if (input.website && input.website.length > 0) {
        return { status: "spam" as const };
      }

      // 2. Timing heuristic — instantaneous submits are almost always bots.
      if (input.elapsedMs != null && input.elapsedMs < MIN_FILL_MS) {
        return { status: "spam" as const };
      }

      // 3. The post must exist and be published.
      const postRows = await ctx.db
        .select({
          id: postTable.id,
          slug: postTable.slug,
          status: postTable.status,
        })
        .from(postTable)
        .where(eq(postTable.id, input.postId))
        .limit(1);
      const postRow = postRows[0];
      if (postRow?.status !== "publish") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      }

      // 4. Validate the reply target, if any.
      if (input.parentId != null) {
        const parent = await ctx.db
          .select({ id: commentTable.id, postId: commentTable.postId })
          .from(commentTable)
          .where(eq(commentTable.id, input.parentId))
          .limit(1);
        if (parent[0]?.postId !== input.postId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid reply target.",
          });
        }
      }

      // 5. Anonymous comments need a display name.
      if (!sessionUser && !input.guestName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please add your name to comment, or sign in.",
        });
      }

      const ip = clientIpFrom(ctx.headers);
      const ipHash = hashIp(ip);
      const userAgent = ctx.headers.get("user-agent") ?? undefined;

      // 6. Blocked IPs — an admin has banned this address. Pretend success so
      //    we don't reveal the ban, but persist nothing.
      const blocked = await ctx.db
        .select({ ipHash: blockedIpTable.ipHash })
        .from(blockedIpTable)
        .where(eq(blockedIpTable.ipHash, ipHash))
        .limit(1);
      if (blocked.length > 0) {
        return { status: "spam" as const };
      }

      // 7. Rate limit per IP.
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
      const recent = await ctx.db
        .select({ c: count() })
        .from(commentTable)
        .where(
          and(
            eq(commentTable.ipHash, ipHash),
            gte(commentTable.createdAt, since),
          ),
        );
      if ((recent[0]?.c ?? 0) >= RATE_LIMIT_MAX) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "You're commenting too fast. Please try again in a bit.",
        });
      }

      // 8. Turnstile — required for anonymous submissions (when configured).
      if (!sessionUser) {
        const ok = await verifyTurnstile(input.turnstileToken, ip);
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bot check failed. Please try again.",
          });
        }
      }

      // 9. Akismet content classification.
      const { spam } = await checkAkismet({
        ip,
        userAgent,
        referrer: ctx.headers.get("referer") ?? undefined,
        permalink: `/${postRow.slug}`,
        body: input.body,
        authorName: sessionUser?.name ?? input.guestName,
        authorEmail: sessionUser?.email ?? input.guestEmail,
        isRegistered: !!sessionUser,
      });

      // 10. Decide moderation status. Signed-in users and clean anonymous
      //    comments are auto-approved; spammy ones are held for review.
      const status: "approved" | "spam" = spam ? "spam" : "approved";

      const inserted = await ctx.db
        .insert(commentTable)
        .values({
          postId: input.postId,
          parentId: input.parentId ?? null,
          userId: sessionUser?.id ?? null,
          guestName: sessionUser ? null : (input.guestName ?? null),
          guestEmail: sessionUser ? null : (input.guestEmail ?? null),
          body: input.body,
          status,
          spamReason: spam ? "akismet" : null,
          ipHash,
          userAgent: userAgent?.slice(0, 512) ?? null,
        })
        .returning({ id: commentTable.id, createdAt: commentTable.createdAt });

      const row = inserted[0];
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return {
        status,
        comment:
          status === "approved"
            ? {
                id: row.id,
                parentId: input.parentId ?? null,
                body: input.body,
                createdAt: row.createdAt,
                authorName: sessionUser?.name ?? input.guestName ?? "Anonymous",
                authorImage: sessionUser?.image ?? null,
                registered: !!sessionUser,
              }
            : null,
      };
    }),

  // ---------- Admin moderation ----------

  /** Comments awaiting review (or any status), newest first. */
  listForAdmin: adminProcedure
    .input(
      z.object({
        status: z.enum(["approved", "pending", "spam"]).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: commentTable.id,
          parentId: commentTable.parentId,
          body: commentTable.body,
          status: commentTable.status,
          createdAt: commentTable.createdAt,
          guestName: commentTable.guestName,
          guestEmail: commentTable.guestEmail,
          spamReason: commentTable.spamReason,
          ipHash: commentTable.ipHash,
          userName: userTable.name,
          userImage: userTable.image,
          postId: commentTable.postId,
          postSlug: postTable.slug,
          postTitle: postTable.title,
        })
        .from(commentTable)
        .leftJoin(userTable, eq(commentTable.userId, userTable.id))
        .innerJoin(postTable, eq(commentTable.postId, postTable.id))
        .where(input.status ? eq(commentTable.status, input.status) : undefined)
        .orderBy(desc(commentTable.createdAt))
        .limit(input.limit);
    }),

  /** Approve, mark spam, or delete a comment. */
  moderate: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.enum(["approve", "spam", "delete"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.action === "delete") {
        await ctx.db.delete(commentTable).where(eq(commentTable.id, input.id));
        return { id: input.id, action: input.action };
      }
      await ctx.db
        .update(commentTable)
        .set({
          status: input.action === "approve" ? "approved" : "spam",
          updatedAt: new Date(),
        })
        .where(eq(commentTable.id, input.id));
      return { id: input.id, action: input.action };
    }),

  /**
   * Reply to a comment as the signed-in admin. The reply is posted publicly
   * (status "approved") under the admin's user account, threaded beneath the
   * target comment.
   */
  reply: adminProcedure
    .input(
      z.object({
        parentId: z.number().int().positive(),
        body: z.string().trim().min(1, "Reply can't be empty.").max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parent = await ctx.db
        .select({ id: commentTable.id, postId: commentTable.postId })
        .from(commentTable)
        .where(eq(commentTable.id, input.parentId))
        .limit(1);
      const parentRow = parent[0];
      if (!parentRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found.",
        });
      }

      const inserted = await ctx.db
        .insert(commentTable)
        .values({
          postId: parentRow.postId,
          parentId: parentRow.id,
          userId: ctx.session.user.id,
          body: input.body,
          status: "approved",
        })
        .returning({ id: commentTable.id });

      const row = inserted[0];
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { id: row.id, parentId: parentRow.id };
    }),

  // ---------- IP blocking ----------

  /** IP addresses currently banned from commenting, newest first. */
  listBlockedIps: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        ipHash: blockedIpTable.ipHash,
        note: blockedIpTable.note,
        createdAt: blockedIpTable.createdAt,
      })
      .from(blockedIpTable)
      .orderBy(desc(blockedIpTable.createdAt));
  }),

  /**
   * Ban an IP from commenting. Provide either a `commentId` (bans the IP that
   * posted that comment) or a raw `ip` to hash and ban. We only ever store the
   * hash; a raw IP entered here is kept verbatim in `note` for display.
   */
  blockIp: adminProcedure
    .input(
      z
        .object({
          commentId: z.number().int().positive().optional(),
          ip: z.string().trim().min(1).max(64).optional(),
          note: z.string().trim().max(255).optional(),
        })
        .refine((v) => v.commentId != null || v.ip != null, {
          message: "Provide a comment or an IP address to block.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      let ipHash: string;
      let note = input.note ?? null;

      if (input.ip) {
        ipHash = hashIp(input.ip);
        note = note ?? input.ip;
      } else {
        const rows = await ctx.db
          .select({ ipHash: commentTable.ipHash })
          .from(commentTable)
          .where(eq(commentTable.id, input.commentId!))
          .limit(1);
        const hash = rows[0]?.ipHash;
        if (!hash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No IP address is recorded for that comment.",
          });
        }
        ipHash = hash;
      }

      await ctx.db
        .insert(blockedIpTable)
        .values({ ipHash, note, createdBy: ctx.session.user.id })
        .onConflictDoNothing();

      return { ipHash };
    }),

  /** Lift a ban for the given IP hash. */
  unblockIp: adminProcedure
    .input(z.object({ ipHash: z.string().length(64) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(blockedIpTable)
        .where(eq(blockedIpTable.ipHash, input.ipHash));
      return { ipHash: input.ipHash };
    }),
});
