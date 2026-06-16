// ───────────────────────────────────────────────────────────────────────────
// BIRTHDAY GATE (temporary) — wrapping-paper login screen.
//
// To retire the surprise:
//   1. Delete this `src/app/welcome/` folder.
//   2. Remove the gate block from `src/middleware.ts`.
//   3. Remove the `isWelcome` check in `src/app/_components/site-chrome.tsx`.
// ───────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { WelcomeGate } from "./welcome-gate";

export const metadata = {
  title: "A little something for you 🎁",
  // Keep the surprise off search engines while the gate is up.
  robots: { index: false, follow: false },
};

// Diagonal candy-stripe "wrapping paper" with a polka-dot overlay, built from
// pure CSS gradients so there's no image asset to clean up later.
const wrappingPaper: React.CSSProperties = {
  backgroundColor: "#c9857a",
  backgroundImage: [
    "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 22px, transparent 22px 44px)",
    "radial-gradient(rgba(255,255,255,0.30) 2.5px, transparent 3px)",
    "radial-gradient(rgba(255,255,255,0.18) 2.5px, transparent 3px)",
  ].join(", "),
  backgroundSize: "auto, 40px 40px, 40px 40px",
  backgroundPosition: "0 0, 0 0, 20px 20px",
};

export default async function WelcomePage() {
  // Anyone who already has a session shouldn't see the gift wrap.
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <main
      style={wrappingPaper}
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
    >
      <div className="relative w-full max-w-md">
        {/* Ribbon bow sitting on top of the gift tag */}
        <div
          aria-hidden="true"
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl drop-shadow-sm"
        >
          🎀
        </div>

        <div className="rounded-3xl bg-gms-cream/95 p-8 pt-12 text-center shadow-2xl ring-1 ring-white/40 backdrop-blur">
          <p className="font-sans text-xs font-bold tracking-[0.22em] text-gms-rose uppercase">
            Happy Birthday
          </p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-gms-ink">
            A little something
            <br />
            made just for you
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-gms-stone">
            This gift is still wrapped. Sign in to peek inside. 💝
          </p>

          <div className="mt-7">
            <WelcomeGate />
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-white/80">
          Wrapped with love · Good Morning Shelly
        </p>
      </div>
    </main>
  );
}
