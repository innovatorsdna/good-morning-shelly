import Link from "next/link";

import { SignOutButton } from "~/app/admin/_components/sign-out-button";

interface Props {
  email?: string | null;
  children: React.ReactNode;
}

export function AdminShell({ email, children }: Props) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-6 sm:flex">
        <Link href="/admin" className="text-lg font-bold tracking-tight">
          Admin
        </Link>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <Link className="rounded px-3 py-2 hover:bg-neutral-100" href="/admin">
            Dashboard
          </Link>
          <Link
            className="rounded px-3 py-2 hover:bg-neutral-100"
            href="/admin/posts"
          >
            Posts
          </Link>
          <Link
            className="rounded px-3 py-2 hover:bg-neutral-100"
            href="/admin/pages"
          >
            Pages
          </Link>
          <Link
            className="mt-6 rounded px-3 py-2 text-neutral-500 hover:bg-neutral-100"
            href="/"
          >
            ← Back to site
          </Link>
        </nav>
        <div className="mt-auto border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          {email && <p className="mb-2 truncate">{email}</p>}
          <SignOutButton />
        </div>
      </aside>
      <div className="flex-1 overflow-x-auto">{children}</div>
    </div>
  );
}
