import Link from "next/link";
import { FeaturedPost, PostCard } from "~/components/post-card";
import { MembersPrompt } from "~/components/members-prompt";
import { getPublishedPosts } from "~/lib/content";
import { getViewer } from "~/server/better-auth/server";
import { TOPICS } from "~/lib/topics";

const GRID_COUNT = 4;

export default async function HomePage() {
  const { canSeePrivate } = await getViewer();
  const posts = await getPublishedPosts({ includePrivate: canSeePrivate });
  const [featured, ...rest] = posts;
  const grid = rest.slice(0, GRID_COUNT);
  const hasMore = posts.length > 1 + GRID_COUNT;

  return (
    <main className="px-6 pt-8">
      {!canSeePrivate && <MembersPrompt />}
      {featured && <FeaturedPost post={featured} />}

      {grid.length > 0 && (
        <>
          <p className="m-0 mb-6 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
            Recent posts
          </p>
          <div className="mb-10 grid grid-cols-2 gap-7 border-b border-gms-line pb-10">
            {grid.map((p, i) => (
              <PostCard key={p.slug} post={p} index={i} />
            ))}
          </div>
        </>
      )}

      {canSeePrivate && (
        <section className="mb-6 rounded-lg bg-gms-panel p-5">
          <p className="m-0 mb-4 border-b border-gms-line pb-2 font-serif text-[15px] font-semibold text-gms-ink">
            Browse by topic
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {TOPICS.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/category/${t.slug}/`}
                  className="flex items-center gap-2 text-[13px] text-gms-stone hover:text-gms-ink"
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: t.color }}
                  />
                  {t.label} — {t.blurb}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasMore && (
        <div className="text-center">
          <Link
            href="/archive/"
            className="border-b-[1.5px] border-gms-rose pb-px text-[12px] font-bold tracking-[0.1em] text-gms-rose uppercase"
          >
            View all {posts.length} posts →
          </Link>
        </div>
      )}
    </main>
  );
}
