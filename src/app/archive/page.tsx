import Link from "next/link";
import { MembersPrompt } from "~/components/members-prompt";
import { formatPostDate, getPublishedPosts } from "~/lib/content";
import { getViewer } from "~/server/better-auth/server";

export const metadata = { title: "Archive — Good Morning Shelly" };

export default async function ArchivePage() {
  const { canSeePrivate } = await getViewer();
  const posts = await getPublishedPosts({ includePrivate: canSeePrivate });
  const byYear = new Map<string, typeof posts>();
  for (const p of posts) {
    const year = p.date ? p.date.slice(0, 4) : "Undated";
    const arr = byYear.get(year) ?? [];
    arr.push(p);
    byYear.set(year, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <main className="px-6 pt-8">
      {!canSeePrivate && <MembersPrompt />}
      <header className="mb-6 text-center">
        <p className="m-0 mb-2 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
          Archive
        </p>
        <h1 className="m-0 font-serif text-[32px] font-semibold text-gms-ink">
          Every post
        </h1>
        <p className="m-0 mt-2 text-[12px] font-light tracking-[0.04em] text-gms-muted">
          {posts.length} posts
        </p>
      </header>
      {years.map((year) => (
        <section key={year} className="mt-8">
          <h2 className="m-0 border-b border-gms-line pb-2 font-serif text-[22px] font-semibold text-gms-ink">
            {year}
          </h2>
          <ul className="m-0 mt-4 list-none space-y-3 p-0">
            {(byYear.get(year) ?? []).map((p) => (
              <li
                key={p.slug}
                className="flex items-baseline gap-4 text-gms-stone"
              >
                <time
                  dateTime={p.date}
                  className="w-32 shrink-0 text-[12px] font-light text-gms-muted"
                >
                  {formatPostDate(p.date)}
                </time>
                <Link href={`/${p.slug}/`} className="hover:text-gms-sage">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
