import Link from "next/link";

import { PostsListFilters } from "~/app/admin/_components/posts-list-filters";
import { PostsListTable } from "~/app/admin/_components/posts-list-table";
import { api } from "~/trpc/server";

interface SearchParams {
  status?: string;
  q?: string;
  page?: string;
}

const STATUSES = ["publish", "draft"] as const;
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

      <PostsListTable
        type={type}
        rows={rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          status: r.status,
          isPrivate: r.isPrivate,
          source: r.source,
          publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
          type: r.type,
        }))}
      />

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
