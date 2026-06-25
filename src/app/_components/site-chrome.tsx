"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";

export function SiteChrome({ children }: { children: React.ReactNode }) {
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
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
