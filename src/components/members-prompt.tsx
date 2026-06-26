import Link from "next/link";

/**
 * Inline nudge shown to signed-out visitors on listing pages, where
 * members-only posts are hidden from the feed. Rendered only when the viewer
 * cannot see private content.
 */
export function MembersPrompt() {
  return (
    <div className="mb-8 rounded-lg border border-gms-line bg-gms-panel px-5 py-4 text-center">
      <p className="m-0 text-[13px] leading-[1.6] text-gms-stone">
        Most of Shelly&apos;s writing is for members.{" "}
        <Link
          href="/login/"
          className="border-b-[1.5px] border-gms-rose pb-px font-bold text-gms-rose hover:opacity-80"
        >
          Sign in
        </Link>{" "}
        to read every post.
      </p>
    </div>
  );
}
