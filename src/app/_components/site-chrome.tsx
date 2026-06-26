"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "~/components/site-footer";

export function SiteChrome({
  header,
  children,
}: {
  // Rendered on the server (it reads the session) and passed in, since this
  // client component can't import the async SiteHeader directly.
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The admin interface and the Love Diary both manage their own full-width
  // layouts, so skip the public site chrome and the narrow reading-width
  // container for those sections.
  const ownsLayout =
    (pathname?.startsWith("/admin") ?? false) ||
    (pathname?.startsWith("/diary") ?? false);

  if (ownsLayout) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-[680px] px-0 pb-12">
      {header}
      {children}
      <SiteFooter />
    </div>
  );
}
