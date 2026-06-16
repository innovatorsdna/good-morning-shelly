import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { env } from "~/env";
import { db } from "~/server/db";

// Enable a social provider only when both its id and secret are configured, so
// the app boots fine in environments where social login isn't set up yet.
const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
    ? {
        facebook: {
          clientId: env.FACEBOOK_CLIENT_ID,
          clientSecret: env.FACEBOOK_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders,
  hooks: {
    // Gate email/password sign-up behind a shared registration key. The key is
    // sent in the request body by the sign-up form and validated here, before
    // any account is created. Social sign-in is unaffected.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const registrationKey = (ctx.body as { registrationKey?: unknown })
        ?.registrationKey;

      if (!env.REGISTRATION_KEY || registrationKey !== env.REGISTRATION_KEY) {
        throw new APIError("FORBIDDEN", {
          message: "Invalid registration key.",
        });
      }
    }),
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        // Users cannot change their own role from client APIs.
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
