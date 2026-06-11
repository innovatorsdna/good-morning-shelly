import "~/styles/globals.css";

import { type Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";

import { SiteChrome } from "~/app/_components/site-chrome";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Good Morning Shelly",
  description: "Personal blog about faith, family, nature, and morning moments.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
