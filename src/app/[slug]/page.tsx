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

export async function generateStaticParams() {
  const items = await getAllItems();
  return items
    .filter((it) => it.status === "publish")
    .map((it) => ({ slug: it.slug }));
}

export async function generateMetadata({ params }: RouteParams) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (item?.status !== "publish") return {};
  return {
    title: item.title,
    description: item.excerpt,
  };
}

export default async function ItemPage({ params }: RouteParams) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (item?.status !== "publish") {
    // Many old WP pages were category landing pages with the same slug
    // as the category. Send those to the category archive instead of 404.
    const cats = await getAllCategories();
    if (cats.find((c) => c.slug === slug)) redirect(`/category/${slug}/`);
    notFound();
  }

  return (
    <main className="px-6 pt-8">
      <article className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-gms-ink prose-a:text-gms-sage prose-p:text-gms-stone">
        <header className="not-prose mb-8 text-center">
          <h1 className="font-serif text-[34px] leading-[1.2] font-semibold text-gms-ink">
            {item.title}
          </h1>
          {item.type === "post" && item.date && (
            <time
              dateTime={item.date}
              className="mt-3 block text-[12px] font-light tracking-[0.04em] text-gms-muted"
            >
              {formatPostDate(item.date)}
            </time>
          )}
          {item.type === "post" &&
            item.categories &&
            item.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                {item.categories.map((c) => (
                  <Link
                    key={c}
                    href={`/category/${c}/`}
                    className="rounded-full bg-gms-panel px-3 py-1 text-[12px] font-bold tracking-[0.1em] text-gms-stone uppercase no-underline hover:text-gms-sage"
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
