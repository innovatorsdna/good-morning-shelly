"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  // The admin interface manages its own full-width layout (sidebar, header),
  // so skip the public site chrome and the narrow reading-width container.
  if (isAdmin) {
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
