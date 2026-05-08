import { notFound } from "next/navigation";
import type { ImgHTMLAttributes } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

const UPLOADS_BASE = process.env.NEXT_PUBLIC_UPLOADS_BASE_URL ?? "";

function rewriteUploadsSrc(src: unknown): string | undefined {
  if (typeof src !== "string") return undefined;
  if (UPLOADS_BASE && src.startsWith("/uploads/")) {
    return UPLOADS_BASE.replace(/\/$/, "") + src;
  }
  return src;
}

const mdxComponents = {
  img: ({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      src={rewriteUploadsSrc(src)}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  ),
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const post = await api.admin.get({ id: numericId }).catch(() => null);
  if (!post) notFound();

  return (
    <article className="prose prose-neutral mx-auto max-w-3xl px-6 py-8">
      <header className="not-prose mb-6 border-b border-neutral-200 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {post.title || <em>(untitled)</em>}
        </h1>
        <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
          Preview · status: {post.status}
        </p>
      </header>
      <MDXRemote
        source={post.body}
        components={mdxComponents}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
      />
    </article>
  );
}
