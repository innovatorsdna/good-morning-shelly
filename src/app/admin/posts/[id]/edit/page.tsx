import Link from "next/link";
import { notFound } from "next/navigation";

import { PostForm } from "~/app/admin/_components/post-form";
import { api } from "~/trpc/server";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const post = await api.admin.get({ id: numericId }).catch(() => null);
  if (!post) notFound();
  if (post.type !== "post") notFound();

  if (post.source === "mdx") {
    return <ArchivedView post={post} />;
  }

  return (
    <PostForm
      type="post"
      initial={{
        id: post.id,
        type: "post",
        title: post.title,
        slug: post.slug,
        body: post.body,
        status: (post.status as "publish" | "draft" | "private") ?? "draft",
        excerpt: post.excerpt,
        cover: post.cover,
        sticky: post.sticky,
        publishedAt: post.publishedAt,
        categories: post.categories,
      }}
    />
  );
}

function ArchivedView({
  post,
}: {
  post: {
    id: number;
    title: string;
    slug: string;
    body: string;
    status: string;
    publishedAt: Date | null;
    categories: string[];
  };
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Archived MDX post.</strong> Imported from the original
        WordPress export and treated as read-only.
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        /{post.slug} · {post.status}
        {post.publishedAt && ` · ${post.publishedAt.toLocaleDateString()}`}
      </p>
      {post.categories.length > 0 && (
        <p className="mt-2 text-sm text-neutral-600">
          Categories: {post.categories.join(", ")}
        </p>
      )}
      <pre className="mt-6 max-h-[600px] overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs">
        {post.body}
      </pre>
      <p className="mt-4 text-sm">
        <Link
          href={`/${post.slug}`}
          className="text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
        >
          View on site →
        </Link>
      </p>
    </main>
  );
}
