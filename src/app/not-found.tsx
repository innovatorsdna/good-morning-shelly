import Link from "next/link";
import {
  formatPostDate,
  getAllCategories,
  getPublishedPosts,
} from "~/lib/content";

export default function NotFound() {
  const categories = getAllCategories();
  const recent = getPublishedPosts().slice(0, 8);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-neutral-600">
        This URL doesn&apos;t lead anywhere. Maybe one of these will help.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Browse by category</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}/`}
                className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-200"
              >
                {c.name}{" "}
                <span className="text-neutral-500">({c.count})</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Recent posts</h2>
        <ul className="mt-4 space-y-2">
          {recent.map((p) => (
            <li key={p.slug} className="flex items-baseline gap-4">
              <time
                dateTime={p.date}
                className="w-32 shrink-0 text-sm text-neutral-500"
              >
                {formatPostDate(p.date)}
              </time>
              <Link href={`/${p.slug}/`} className="hover:text-neutral-600">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm">
          <Link
            href="/archive/"
            className="text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
          >
            View the full archive →
          </Link>
        </p>
      </section>
    </main>
  );
}
