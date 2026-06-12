import { CommentsModeration } from "~/app/admin/_components/comments-moderation";

export const metadata = { title: "Comments — Admin" };

export default function CommentsAdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Comments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Review flagged comments and moderate what appears on the blog.
        </p>
      </header>
      <CommentsModeration />
    </main>
  );
}
