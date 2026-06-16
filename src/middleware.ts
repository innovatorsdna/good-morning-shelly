import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// ───────────────────────────────────────────────────────────────────────────
// BIRTHDAY GATE (temporary) — hide every public page behind /welcome until the
// surprise is revealed. Visitors without a session are redirected to the
// wrapping-paper login page; anyone with a session cookie passes through.
//
// To retire the gate, either flip BIRTHDAY_GATE_ENABLED to false, or remove
// this block + the `birthdayGate()` call below, then delete the
// `src/app/welcome/` folder and the `isWelcome` check in site-chrome.tsx.
const BIRTHDAY_GATE_ENABLED = true;
const GATE_PATH = "/welcome";

function birthdayGate(request: NextRequest): NextResponse | null {
  if (!BIRTHDAY_GATE_ENABLED) return null;

  const { pathname } = request.nextUrl;

  // Let through the gate page itself, auth/API routes, and the admin area
  // (which enforces its own sign-in). Everything else is gated.
  if (
    pathname === GATE_PATH ||
    pathname.startsWith(`${GATE_PATH}/`) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  // Optimistic cookie check (no DB round-trip) — good enough for a gate.
  if (getSessionCookie(request)) return null;

  const destination = new URL(GATE_PATH, request.url);
  return NextResponse.redirect(destination);
}
// ───────────────────────────────────────────────────────────────────────────

// `next.config.js` sets `trailingSlash: true` for SEO continuity with the
// previous WordPress site. The built-in Next.js redirect that enforces this
// breaks Better Auth's `/api/auth/[...all]` route: requests arrive without
// a slash, get 308'd to a slash-terminated URL, and the catch-all then
// 404s on the empty trailing segment.
//
// We disable that automatic redirect via `skipTrailingSlashRedirect` and
// re-implement it here, skipping `/api/*` so the auth handler sees the
// URL the client actually sent.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // BIRTHDAY GATE (temporary) — runs before the trailing-slash logic so
  // unauthenticated visitors never reach a public page. Remove with the block
  // above when retiring the gate.
  const gated = birthdayGate(request);
  if (gated) return gated;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname.endsWith("/")) {
    return NextResponse.next();
  }

  // Skip paths that look like a file (have an extension in the last segment),
  // e.g. `/sitemap.xml`, `/rss.xml`, `/favicon.ico`.
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) {
    return NextResponse.next();
  }

  const destination = new URL(`${pathname}/${search}`, request.url);
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
