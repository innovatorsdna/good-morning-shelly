import { auth } from ".";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export interface Viewer {
  /** True when a session exists (any signed-in member or admin). */
  isLoggedIn: boolean;
  /** True for accounts with the "admin" role. */
  isAdmin: boolean;
  /**
   * Whether this viewer may see members-only (private) posts. Every signed-in
   * account is a member, so this is simply "is logged in". Reading these tables
   * uses `headers()`, which opts pages that call it into dynamic rendering —
   * required so private content is gated per request rather than baked at build.
   */
  canSeePrivate: boolean;
}

/** Resolve the current viewer's audience for content gating. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getSession();
  const isLoggedIn = Boolean(session);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  return { isLoggedIn, isAdmin, canSeePrivate: isLoggedIn };
});
