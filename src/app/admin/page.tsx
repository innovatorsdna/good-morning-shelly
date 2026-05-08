import Link from "next/link";

import { api } from "~/trpc/server";

export default async function AdminDashboard() {
  const stats = await api.admin.stats();
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
    </main>
  );
}
