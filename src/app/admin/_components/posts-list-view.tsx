import Link from "next/link";

import { PostsListFilters } from "~/app/admin/_components/posts-list-filters";
import { formatPostDate } from "~/lib/content";
import { api } from "~/trpc/server";

interface SearchParams {
  status?: string;
  q?: string;
  page?: string;
}

const STATUSES = ["publish", "draft", "private"] as const;
type Status = (typeof STATUSES)[number];

function parseStatus(s: string | undefined): Status | undefined {
  return STATUSES.includes(s as Status) ? (s as Status) : undefined;
}

export async function PostsListView({
  type,
  searchParams,
  title,
}: {
  type: "post" | "page";
  searchParams: Promise<SearchParams>;
  title: string;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const status = parseStatus(sp.status);
  const q = (sp.q ?? "").trim() || undefined;
  const pageSize = 50;

  const { rows, total } = await api.admin.list({
    type,
    status,
    q,
    page,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const basePath = type === "post" ? "/admin/posts" : "/admin/pages";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <Link
          href={`${basePath}/new`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New {type}
        </Link>
      </header>

      <PostsListFilters
        action={basePath}
        defaultQuery={q ?? ""}
        defaultStatus={status ?? ""}
      />

      <p className="mt-4 text-sm text-neutral-500">
        {total} {type === "post" ? "posts" : "pages"}
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  No {type === "post" ? "posts" : "pages"} found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {r.title || <em>(untitled)</em>}
                  </div>
                  <div className="text-xs text-neutral-500">/{r.slug}</div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} source={r.source} />
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {r.publishedAt
                    ? formatPostDate(r.publishedAt.toISOString())
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.source === "mdx" ? (
                    <span className="text-xs text-neutral-400">read-only</span>
                  ) : (
                    <Link
                      href={`${basePath}/${r.id}/edit`}
                      className="text-sm text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                    >
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination
          basePath={basePath}
          page={page}
          totalPages={totalPages}
          status={status}
          q={q}
        />
      )}
    </main>
  );
}

function StatusBadge({ status, source }: { status: string; source: string }) {
  const cls =
    status === "publish"
      ? "bg-green-100 text-green-800"
      : status === "private"
        ? "bg-amber-100 text-amber-800"
        : "bg-neutral-200 text-neutral-700";
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
        {status}
      </span>
      {source === "mdx" && (
        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          archived
        </span>
      )}
    </div>
  );
}

function Pagination({
  basePath,
  page,
  totalPages,
  status,
  q,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  status: string | undefined;
  q: string | undefined;
}) {
  const params = (p: number) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="mt-6 flex items-center justify-between text-sm">
      <Link
        aria-disabled={page <= 1}
        className={`rounded border border-neutral-200 px-3 py-1.5 ${
          page <= 1
            ? "pointer-events-none text-neutral-300"
            : "text-neutral-700 hover:bg-neutral-100"
        }`}
        href={params(Math.max(1, page - 1))}
      >
        ← Previous
      </Link>
      <span className="text-neutral-500">
        Page {page} of {totalPages}
      </span>
      <Link
        aria-disabled={page >= totalPages}
        className={`rounded border border-neutral-200 px-3 py-1.5 ${
          page >= totalPages
            ? "pointer-events-none text-neutral-300"
            : "text-neutral-700 hover:bg-neutral-100"
        }`}
        href={params(Math.min(totalPages, page + 1))}
      >
        Next →
      </Link>
    </nav>
  );
}
