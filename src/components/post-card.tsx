import Link from "next/link";
import { type ContentItem, formatPostDate } from "~/lib/content";

export function PostCard({ post }: { post: ContentItem }) {
  return (
    <article className="border-b border-neutral-200 py-6">
      <Link href={`/${post.slug}/`} className="group block">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 group-hover:text-neutral-600">
          {post.title}
        </h2>
        <div className="mt-1 text-sm text-neutral-500">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          {post.categories && post.categories.length > 0 && (
            <span className="ml-3">
              {post.categories.slice(0, 3).join(" · ")}
            </span>
          )}
        </div>
        {post.excerpt && (
          <p className="mt-3 text-neutral-700">{post.excerpt}</p>
        )}
      </Link>
    </article>
  );
}
