import "server-only";
import { createHash } from "crypto";

import { env } from "~/env";

/**
 * Spam / bot filtering helpers for reader comments.
 *
 * Every external check "fails open": when the relevant credential isn't
 * configured (e.g. local development), the check is skipped rather than
 * blocking legitimate comments. Production should set the keys so the checks
 * actually run.
 */

/** SHA-256 a value (used to avoid storing raw IP addresses). */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** Pull the best-guess client IP out of the request headers. */
export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true when the token is valid, or when no secret is configured.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured → skip
  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    });
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Network/Cloudflare error: don't block the commenter on infra hiccups.
    return true;
  }
}

interface AkismetParams {
  ip: string;
  userAgent: string | undefined;
  referrer: string | undefined;
  permalink: string | undefined;
  body: string;
  authorName: string | undefined;
  authorEmail: string | undefined;
  /** True when the comment author is signed in (lowers false positives). */
  isRegistered: boolean;
}

/**
 * Classify a comment with Akismet.
 * Returns { spam } — defaults to not-spam when Akismet isn't configured or errors.
 */
export async function checkAkismet(
  params: AkismetParams,
): Promise<{ spam: boolean }> {
  if (!env.AKISMET_API_KEY) return { spam: false }; // not configured → skip

  const blog =
    env.NEXT_PUBLIC_SITE_URL && env.NEXT_PUBLIC_SITE_URL.length > 0
      ? env.NEXT_PUBLIC_SITE_URL
      : "http://localhost:3000";
  try {
    const form = new URLSearchParams({
      blog,
      user_ip: params.ip,
      comment_type: "comment",
      comment_content: params.body,
    });
    if (params.userAgent) form.set("user_agent", params.userAgent);
    if (params.referrer) form.set("referrer", params.referrer);
    if (params.permalink) form.set("permalink", params.permalink);
    if (params.authorName) form.set("comment_author", params.authorName);
    if (params.authorEmail)
      form.set("comment_author_email", params.authorEmail);
    if (params.isRegistered) form.set("user_role", "registered");

    const res = await fetch(
      `https://${env.AKISMET_API_KEY}.rest.akismet.com/1.1/comment-check`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
    );
    const text = (await res.text()).trim();
    // Akismet returns the literal string "true" for spam, "false" otherwise.
    return { spam: text === "true" };
  } catch {
    // Don't block on Akismet being unreachable.
    return { spam: false };
  }
}
