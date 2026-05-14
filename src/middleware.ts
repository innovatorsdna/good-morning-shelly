import { NextResponse, type NextRequest } from "next/server";

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
