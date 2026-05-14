/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./src/env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** @type {Array<{ from: string, to: string }>} */
const redirects = JSON.parse(
  readFileSync(path.join(here, "migration/redirects.json"), "utf-8"),
);

/** @type {import("next").NextConfig} */
const config = {
  trailingSlash: true,
  // Trailing-slash canonicalisation is handled manually in `src/middleware.ts`
  // so that `/api/*` routes (Better Auth's catch-all in particular) keep
  // working — the built-in 308 redirect appends a slash that the
  // `[...all]` route then 404s on.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return redirects.map((r) => ({
      source: r.from,
      destination: r.to,
      permanent: true,
    }));
  },
};

export default config;
