"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

type Mode = "sign-in" | "sign-up";

const inputClass =
  "border-gms-line text-gms-ink placeholder:text-gms-muted focus:border-gms-sage w-full rounded-md border bg-white px-3 py-2 text-[15px] focus:outline-none";

const labelClass =
  "text-gms-stone mb-1 block text-[11px] font-bold tracking-[0.14em] uppercase";

interface AuthFormProps {
  /**
   * Where to send the user after a successful sign-in/sign-up. When omitted,
   * the current route is simply refreshed (used by the admin gate, which
   * re-renders in place). Should always be an internal path.
   */
  redirectTo?: string;
}

export function AuthForm({ redirectTo }: AuthFormProps = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationKey, setRegistrationKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            name,
            email,
            password,
            // Validated server-side against REGISTRATION_KEY before the
            // account is created.
            registrationKey,
          } as Parameters<typeof authClient.signUp.email>[0]);

    setLoading(false);

    if (error) {
      setError(error.message ?? "Something went wrong");
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  };

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-[11px] font-bold tracking-[0.14em] uppercase transition-colors ${
      active ? "bg-gms-rose text-white" : "text-gms-stone hover:text-gms-ink"
    }`;

  return (
    <div className="bg-gms-panel border-gms-line flex w-full max-w-sm flex-col gap-5 rounded-lg border p-6">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("sign-in");
            setError(null);
          }}
          className={tabClass(mode === "sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("sign-up");
            setError(null);
          }}
          className={tabClass(mode === "sign-up")}
        >
          Sign up
        </button>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {mode === "sign-up" && (
          <label className="block">
            <span className={labelClass}>Name</span>
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        )}

        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Password</span>
          <input
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {mode === "sign-up" && (
          <label className="block">
            <span className={labelClass}>Registration key</span>
            <input
              type="password"
              required
              placeholder="Required to create an account"
              value={registrationKey}
              onChange={(e) => setRegistrationKey(e.target.value)}
              className={inputClass}
            />
            <span className="text-gms-muted mt-1 block text-[12px] leading-[1.5] font-light">
              Account creation is invite-only. Enter the registration key to
              continue.
            </span>
          </label>
        )}

        {error && <p className="text-gms-rose m-0 text-[13px]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-gms-rose mt-1 rounded-md px-5 py-2.5 text-[12px] font-bold tracking-[0.1em] text-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? "Please wait…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
