import { type Config } from "drizzle-kit";

import { env } from "~/env";

const url = env.TURSO_DATABASE_URL ?? env.DATABASE_URL ?? "file:./db.sqlite";
const isTurso = url.startsWith("libsql");

export default (
  isTurso
    ? {
        schema: "./src/server/db/schema.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: {
          url,
          authToken: env.TURSO_AUTH_TOKEN,
        },
      }
    : {
        schema: "./src/server/db/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: { url },
      }
) satisfies Config;
