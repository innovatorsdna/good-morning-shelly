import "~/styles/globals.css";

import { type Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";

import { SiteChrome } from "~/app/_components/site-chrome";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Good Morning Shelly",
  description: "Personal blog about faith, family, nature, and morning moments.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    // Used by iOS when the site is added to the home screen.
    apple: [{ url: "/favicon.svg" }],
  },
  // Generates the Apple PWA meta tags so iOS Safari's "Add to Home Screen"
  // installs a full-screen, standalone web app:
  //   <meta name="apple-mobile-web-app-capable" content="yes">
  //   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  //   <meta name="apple-mobile-web-app-title" content="Good Morning Shelly">
  appleWebApp: {
    capable: true,
    title: "Good Morning Shelly",
    statusBarStyle: "black-translucent",
  },
};

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lato.variable} ${playfair.variable}`}>
      <body className="bg-gms-cream font-sans text-gms-ink antialiased">
        <TRPCReactProvider>
          <SiteChrome>{children}</SiteChrome>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
