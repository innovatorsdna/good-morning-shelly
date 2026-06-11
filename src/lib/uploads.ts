const UPLOADS_BASE = process.env.NEXT_PUBLIC_UPLOADS_BASE_URL ?? "";

/** Rewrite a `/uploads/...` path to the configured CDN base, if any. */
export function uploadsUrl(src: string | null | undefined): string | undefined {
  if (typeof src !== "string" || src.length === 0) return undefined;
  if (UPLOADS_BASE && src.startsWith("/uploads/")) {
    return UPLOADS_BASE.replace(/\/$/, "") + src;
  }
  return src;
}
