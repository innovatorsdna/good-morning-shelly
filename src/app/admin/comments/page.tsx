import { BlockedIps } from "~/app/admin/_components/blocked-ips";
import { CommentsModeration } from "~/app/admin/_components/comments-moderation";

export const metadata = { title: "Comments — Admin" };

export default function CommentsAdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Comments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Review recent comments, reply, delete, and moderate what appears on
          the blog.
        </p>
      </header>
      <CommentsModeration />

      <section className="mt-14">
        <h2 className="text-xl font-bold tracking-tight">Blocked IPs</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Addresses banned from commenting. Block an IP directly from a comment
          above, or add one here.
        </p>
        <BlockedIps />
      </section>
    </main>
  );
}
