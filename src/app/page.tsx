import Link from "next/link";
import { PostCard } from "~/components/post-card";
import { getPublishedPosts } from "~/lib/content";

const PER_PAGE = 30;

export default async function HomePage() {
  const posts = await getPublishedPosts();
  const visible = posts.slice(0, PER_PAGE);
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {visible.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
      {posts.length > PER_PAGE && (
        <div className="mt-10 text-center">
          <Link
            href="/archive/"
            className="text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
          >
            View all {posts.length} posts in the archive →
          </Link>
        </div>
      )}
    </main>
  );
}
