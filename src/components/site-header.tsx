import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Good Morning Shelly
        </Link>
        <nav className="flex items-center gap-6 text-sm text-neutral-600">
          <Link href="/about/" className="hover:text-neutral-900">
            About
          </Link>
          <Link href="/categories/" className="hover:text-neutral-900">
            Categories
          </Link>
          <Link href="/archive/" className="hover:text-neutral-900">
            Archive
          </Link>
        </nav>
      </div>
    </header>
  );
}
