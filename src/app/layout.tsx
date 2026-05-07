import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Good Morning Shelly",
  description: "Personal blog about faith, family, nature, and morning moments.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-white font-sans text-neutral-900 antialiased">
        <TRPCReactProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
