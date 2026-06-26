import { notFound } from "next/navigation";
import { PostCard } from "~/components/post-card";
import { MembersPrompt } from "~/components/members-prompt";
import {
  getCategoryDisplayName,
  getPostsByCategory,
} from "~/lib/content";
import { getViewer } from "~/server/better-auth/server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// This page reads the session via `getViewer()` (and the shared layout's
// SiteHeader does too) to scope which posts a viewer may see. Both call
// `headers()`, which opts the route into dynamic rendering. Statically
// prerendering it via `generateStaticParams` would call `headers()` at build
// time and throw a DynamicServerError (digest DYNAMIC_SERVER_USAGE) that
// surfaces as a 500, so render on demand instead.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RouteParams) {
  const { slug } = await params;
  return { title: `${getCategoryDisplayName(slug)} — Good Morning Shelly` };
}

export default async function CategoryPage({ params }: RouteParams) {
  const { slug } = await params;
  const { canSeePrivate } = await getViewer();
  const posts = await getPostsByCategory(slug, { includePrivate: canSeePrivate });
  if (posts.length === 0) notFound();

  return (
    <main className="px-6 pt-8">
      {!canSeePrivate && <MembersPrompt />}
      <header className="mb-10 border-b border-gms-line pb-5 text-center">
        <p className="m-0 mb-2 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
          Category
        </p>
        <h1 className="m-0 font-serif text-[32px] leading-[1.15] font-semibold text-gms-ink">
          {getCategoryDisplayName(slug)}
        </h1>
        <p className="m-0 mt-2 text-[12px] font-light tracking-[0.04em] text-gms-muted">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-7">
        {posts.map((p, i) => (
          <PostCard key={p.slug} post={p} index={i} />
        ))}
      </div>
    </main>
  );
}
