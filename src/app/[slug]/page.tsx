import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ImgHTMLAttributes } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { CommentsSection } from "~/app/_components/comments/comments-section";
import {
  formatPostDate,
  getAllCategories,
  getCategoryDisplayName,
  getItemBySlug,
} from "~/lib/content";
import { getViewer } from "~/server/better-auth/server";

// The shared layout (SiteHeader) reads the session via `headers()` to show the
// Sign in / Sign out control, and members-only posts are gated per request.
// Both opt this route into dynamic rendering, so it can't be statically
// prerendered: doing so would call `headers()` at build time and throw a
// DynamicServerError (digest DYNAMIC_SERVER_USAGE) that surfaces as a 500.
// Render on demand instead of declaring `generateStaticParams`.
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

export async function generateMetadata({ params }: RouteParams) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (item?.status !== "publish") return {};
  if (item.isPrivate) {
    // Never index members-only posts. Only reveal the title/excerpt to a
    // viewer who is actually allowed to read the post.
    const { canSeePrivate } = await getViewer();
    return {
      title: canSeePrivate ? item.title : "Members only — Good Morning Shelly",
      description: canSeePrivate ? item.excerpt : undefined,
      robots: { index: false, follow: false },
    };
  }
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

  // Gate members-only posts: signed-out visitors are sent to the login page
  // and returned here afterwards. Every signed-in account is a member, so a
  // present session is enough to read it.
  if (item.isPrivate) {
    const { canSeePrivate } = await getViewer();
    if (!canSeePrivate) {
      redirect(`/login/?next=${encodeURIComponent(`/${slug}/`)}`);
    }
  }

  return (
    <main className="px-6 pt-8">
      <article className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-gms-ink prose-a:text-gms-sage prose-p:text-gms-stone">
        {item.cover && (
          <div className="not-prose mb-8 overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rewriteUploadsSrc(item.cover)}
              alt={item.title}
              loading="eager"
              decoding="async"
              className="max-h-[480px] w-full object-cover"
            />
          </div>
        )}
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
      {item.type === "post" && <CommentsSection postId={item.id} />}
    </main>
  );
}
