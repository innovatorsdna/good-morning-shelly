import Link from "next/link";

import { formatPostDate } from "~/lib/content";
import { api } from "~/trpc/server";

export default async function AdminDashboard() {
  const [stats, recent] = await Promise.all([
    api.admin.stats(),
    api.admin.recentEdits({ limit: 10 }),
  ]);
  const c = stats.counts;

  const tiles: Array<{ label: string; value: number; href?: string }> = [
    {
      label: "Published posts",
      value: c["post:publish"] ?? 0,
      href: "/admin/posts?status=publish",
    },
    {
      label: "Drafts",
      value: c["post:draft"] ?? 0,
      href: "/admin/posts?status=draft",
    },
    {
      label: "Private",
      value: c["post:private"] ?? 0,
      href: "/admin/posts?status=private",
    },
    {
      label: "Pages",
      value:
        (c["page:publish"] ?? 0) +
        (c["page:draft"] ?? 0) +
        (c["page:private"] ?? 0),
      href: "/admin/pages",
    },
    {
      label: "Archived (read-only)",
      value: stats.archived,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/posts/new"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            New post
          </Link>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const inner = (
            <>
              <div className="text-3xl font-bold">{t.value}</div>
              <div className="mt-1 text-sm text-neutral-600">{t.label}</div>
            </>
          );
          return t.href ? (
            <Link
              key={t.label}
              href={t.href}
              className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={t.label}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              {inner}
            </div>
          );
        })}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent edits</h2>
        </div>
        <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {recent.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-neutral-500">
              No edits yet.
            </li>
          )}
          {recent.map((r) => {
            const editHref =
              r.source === "mdx"
                ? null
                : r.type === "page"
                  ? `/admin/pages/${r.id}/edit`
                  : `/admin/posts/${r.id}/edit`;
            const inner = (
              <div className="flex items-baseline gap-3">
                <span className="font-medium text-neutral-900">
                  {r.title || <em>(untitled)</em>}
                </span>
                <span className="text-xs text-neutral-500">/{r.slug}</span>
                {r.source === "mdx" && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                    archived
                  </span>
                )}
                <span className="ml-auto text-xs text-neutral-500">
                  {r.updatedAt && formatPostDate(r.updatedAt.toISOString())}
                </span>
              </div>
            );
            return (
              <li key={r.id} className="px-4 py-2 text-sm">
                {editHref ? (
                  <Link
                    href={editHref}
                    className="block rounded -mx-2 px-2 py-1 hover:bg-neutral-100"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="-mx-2 px-2 py-1 text-neutral-500">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
