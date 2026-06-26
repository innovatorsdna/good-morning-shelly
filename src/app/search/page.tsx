import Link from "next/link";
import {
  type ContentItem,
  formatPostDate,
  getCategoryDisplayName,
  searchPosts,
} from "~/lib/content";
import { getViewer } from "~/server/better-auth/server";

export const metadata = { title: "Search — Good Morning Shelly" };

interface SearchParams {
  q?: string;
  from?: string;
  to?: string;
}

/** Strip markdown/MDX/HTML markup down to readable prose for snippets. */
function toPlainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/<[^>]+>/g, " ") // html/jsx tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/[#>*_`~|-]/g, " ") // residual markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a ~30-word snippet centered on the first match of `query`. */
function snippetFor(body: string, query: string): string {
  const text = toPlainText(body);
  if (!query) return text.slice(0, 200);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 200);
  const start = Math.max(0, idx - 90);
  const end = Math.min(text.length, idx + query.length + 110);
  const prefix = start > 0 ? "… " : "";
  const suffix = end < text.length ? " …" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function ResultRow({ post, query }: { post: ContentItem; query: string }) {
  const cat = post.categories?.[0];
  return (
    <article className="border-gms-line border-b pb-6">
      {cat && (
        <p className="text-gms-sage m-0 mb-1 text-[10px] font-bold tracking-[0.18em] uppercase">
          {getCategoryDisplayName(cat)}
        </p>
      )}
      <h2 className="text-gms-ink m-0 mb-1 font-serif text-[20px] leading-[1.3] font-semibold">
        <Link href={`/${post.slug}/`} className="hover:text-gms-stone">
          {post.title}
        </Link>
      </h2>
      <p className="text-gms-muted m-0 mb-2 text-[12px] font-light tracking-[0.04em]">
        {formatPostDate(post.date)}
      </p>
      <p className="text-gms-stone m-0 text-[14px] leading-[1.7]">
        {snippetFor(post.body, query)}
      </p>
    </article>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const hasCriteria = Boolean(q || from || to);

  const { canSeePrivate } = await getViewer();
  const results = hasCriteria
    ? await searchPosts({ query: q, from, to, includePrivate: canSeePrivate })
    : [];

  return (
    <main className="px-6 pt-8">
      <header className="mb-6 text-center">
        <p className="text-gms-rose m-0 mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
          Search
        </p>
        <h1 className="text-gms-ink m-0 font-serif text-[32px] font-semibold">
          Find a post
        </h1>
      </header>

      <form
        method="get"
        action="/search/"
        className="bg-gms-panel mb-8 rounded-lg p-5"
      >
        <label className="block">
          <span className="text-gms-stone mb-1 block text-[11px] font-bold tracking-[0.14em] uppercase">
            Keywords
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search titles and writing…"
            className="border-gms-line text-gms-ink placeholder:text-gms-muted focus:border-gms-sage w-full rounded-md border bg-white px-3 py-2 text-[15px] focus:outline-none"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex-1 basis-40">
            <span className="text-gms-stone mb-1 block text-[11px] font-bold tracking-[0.14em] uppercase">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="border-gms-line text-gms-ink focus:border-gms-sage w-full rounded-md border bg-white px-3 py-2 text-[14px] focus:outline-none"
            />
          </label>
          <label className="flex-1 basis-40">
            <span className="text-gms-stone mb-1 block text-[11px] font-bold tracking-[0.14em] uppercase">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="border-gms-line text-gms-ink focus:border-gms-sage w-full rounded-md border bg-white px-3 py-2 text-[14px] focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="submit"
            className="bg-gms-rose rounded-md px-5 py-2 text-[12px] font-bold tracking-[0.1em] text-white uppercase transition-opacity hover:opacity-90"
          >
            Search
          </button>
          {hasCriteria && (
            <Link
              href="/search/"
              className="text-gms-muted hover:text-gms-stone text-[12px] font-bold tracking-[0.1em] uppercase"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {hasCriteria && (
        <p className="text-gms-muted m-0 mb-6 text-[12px] font-light tracking-[0.04em]">
          {results.length === 0
            ? "No posts found"
            : `${results.length} ${results.length === 1 ? "post" : "posts"} found`}
        </p>
      )}

      <div className="space-y-6">
        {results.map((post) => (
          <ResultRow key={post.slug} post={post} query={q} />
        ))}
      </div>

      {!hasCriteria && (
        <p className="text-gms-stone m-0 text-center text-[14px] leading-[1.7]">
          Enter a word or phrase, or pick a date range, to search the archive.
        </p>
      )}
    </main>
  );
}
