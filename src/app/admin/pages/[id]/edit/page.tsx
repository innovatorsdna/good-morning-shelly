import Link from "next/link";
import { notFound } from "next/navigation";

import { PostForm } from "~/app/admin/_components/post-form";
import { api } from "~/trpc/server";

export default async function EditPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const item = await api.admin.get({ id: numericId }).catch(() => null);
  if (!item) notFound();
  if (item.type !== "page") notFound();

  if (item.source === "mdx") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Archived MDX page.</strong> Read-only.
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
        <pre className="mt-6 max-h-[600px] overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs">
          {item.body}
        </pre>
        <p className="mt-4 text-sm">
          <Link
            href={`/${item.slug}`}
            className="text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
          >
            View on site →
          </Link>
        </p>
      </main>
    );
  }

  return (
    <PostForm
      type="page"
      initial={{
        id: item.id,
        type: "page",
        title: item.title,
        slug: item.slug,
        body: item.body,
        status: (item.status as "publish" | "draft" | "private") ?? "draft",
        excerpt: item.excerpt,
        cover: item.cover,
        sticky: item.sticky,
        publishedAt: item.publishedAt,
        categories: item.categories,
      }}
    />
  );
}
