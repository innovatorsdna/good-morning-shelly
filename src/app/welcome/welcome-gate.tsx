"use client";

// ───────────────────────────────────────────────────────────────────────────
// BIRTHDAY GATE (temporary) — safe to delete the whole `src/app/welcome/`
// folder once the surprise is revealed. See src/middleware.ts for the gate
// logic that points unauthenticated visitors here.
// ───────────────────────────────────────────────────────────────────────────

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

export function WelcomeGate() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.signIn.email({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message ?? "That didn't work — try again?");
      return;
    }

    // Session cookie is now set, so the middleware gate will let us through.
    router.push("/");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 text-left"
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-gms-stone">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-gms-line bg-white px-3 py-2 text-gms-ink outline-none transition focus:border-gms-rose focus:ring-2 focus:ring-gms-rose/30"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gms-stone">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-gms-line bg-white px-3 py-2 text-gms-ink outline-none transition focus:border-gms-rose focus:ring-2 focus:ring-gms-rose/30"
        />
      </label>

      {error && <p className="text-sm text-gms-rose">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-full bg-gms-rose px-6 py-3 font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {loading ? "Unwrapping…" : "Open your gift 🎀"}
      </button>
    </form>
  );
}
