import Link from "next/link";
import { formatPostDate, getPublishedPosts } from "~/lib/content";

export const metadata = { title: "Archive — Good Morning Shelly" };

export default async function ArchivePage() {
  const posts = await getPublishedPosts();
  const byYear = new Map<string, typeof posts>();
  for (const p of posts) {
    const year = p.date ? p.date.slice(0, 4) : "Undated";
    const arr = byYear.get(year) ?? [];
    arr.push(p);
    byYear.set(year, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Archive</h1>
      <p className="mt-2 text-sm text-neutral-500">{posts.length} posts</p>
      {years.map((year) => (
        <section key={year} className="mt-10">
          <h2 className="border-b border-neutral-200 pb-2 text-2xl font-semibold">
            {year}
          </h2>
          <ul className="mt-4 space-y-2">
            {(byYear.get(year) ?? []).map((p) => (
              <li
                key={p.slug}
                className="flex items-baseline gap-4 text-neutral-800"
              >
                <time
                  dateTime={p.date}
                  className="w-32 shrink-0 text-sm text-neutral-500"
                >
                  {formatPostDate(p.date)}
                </time>
                <Link
                  href={`/${p.slug}/`}
                  className="hover:text-neutral-600"
                >
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
