"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });

    setLoading(false);

    if (error) {
      setError(error.message ?? "Something went wrong");
      return;
    }

    router.refresh();
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-white/10 p-6">
      <div className="flex justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className={`rounded-full px-4 py-1 transition ${
            mode === "sign-in" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className={`rounded-full px-4 py-1 transition ${
            mode === "sign-up" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          Sign up
        </button>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {mode === "sign-up" && (
          <input
            type="text"
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md bg-white/10 px-3 py-2 placeholder-white/50 outline-none focus:bg-white/20"
          />
        )}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md bg-white/10 px-3 py-2 placeholder-white/50 outline-none focus:bg-white/20"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md bg-white/10 px-3 py-2 placeholder-white/50 outline-none focus:bg-white/20"
        />

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50"
        >
          {loading
            ? "Please wait..."
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
