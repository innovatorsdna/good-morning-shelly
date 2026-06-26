import { adminRouter } from "~/server/api/routers/admin";
import { commentRouter } from "~/server/api/routers/comment";
import { contactRouter } from "~/server/api/routers/contact";
import { diaryRouter } from "~/server/api/routers/diary";
import { postRouter } from "~/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  admin: adminRouter,
  comment: commentRouter,
  contact: contactRouter,
  diary: diaryRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
