import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Placeholder router. The real admin/post procedures land in PR #2 under
// a dedicated `admin` namespace.
export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => ({ greeting: `Hello ${input.text}` })),
});
