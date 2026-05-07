import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

const url = env.TURSO_DATABASE_URL ?? env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Missing database URL. Set TURSO_DATABASE_URL (production) or DATABASE_URL (local).",
  );
}

export const client =
  globalForDb.client ??
  createClient({
    url,
    authToken: env.TURSO_AUTH_TOKEN,
  });
if (env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
