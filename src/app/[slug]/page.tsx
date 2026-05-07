import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ImgHTMLAttributes } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import {
  formatPostDate,
  getAllCategories,
  getAllItems,
  getCategoryDisplayName,
  getItemBySlug,
} from "~/lib/content";

const UPLOADS_BASE = process.env.NEXT_PUBLIC_UPLOADS_BASE_URL ?? "";

function rewriteUploadsSrc(src: unknown): string | undefined {
  if (typeof src !== "string") return undefined;
  if (UPLOADS_BASE && src.startsWith("/uploads/")) {
    return UPLOADS_BASE.replace(/\/$/, "") + src;
  }
  return src;
}

const mdxComponents = {
  img: ({
    src,
    ...rest
  }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      src={rewriteUploadsSrc(src)}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  ),
};

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllItems()
    .filter((it) => it.status === "publish")
    .map((it) => ({ slug: it.slug }));
}

export async function generateMetadata({ params }: RouteParams) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (item?.status !== "publish") return {};
  return {
    title: item.title,
    description: item.excerpt,
  };
}

export default async function ItemPage({ params }: RouteParams) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (item?.status !== "publish") {
    // Many old WP pages were category landing pages with the same slug
    // as the category. Send those to the category archive instead of 404.
    const matchingCategory = getAllCategories().find((c) => c.slug === slug);
    if (matchingCategory) redirect(`/category/${slug}/`);
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <article className="prose prose-neutral max-w-none">
        <header className="not-prose mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
            {item.title}
          </h1>
          {item.type === "post" && item.date && (
            <time
              dateTime={item.date}
              className="mt-2 block text-sm text-neutral-500"
            >
              {formatPostDate(item.date)}
            </time>
          )}
          {item.type === "post" &&
            item.categories &&
            item.categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {item.categories.map((c) => (
                  <Link
                    key={c}
                    href={`/category/${c}/`}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700 hover:bg-neutral-200"
                  >
                    {getCategoryDisplayName(c)}
                  </Link>
                ))}
              </div>
            )}
        </header>
        <MDXRemote
          source={item.body}
          components={mdxComponents}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        />
      </article>
    </main>
  );
}
