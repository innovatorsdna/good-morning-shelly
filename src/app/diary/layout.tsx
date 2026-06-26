import { AuthForm } from "~/app/_components/auth-form";
import { SignOutButton } from "~/app/admin/_components/sign-out-button";
import { getSession } from "~/server/better-auth/server";

export const metadata = { title: "Love Diary" };

/**
 * Gate for the whole `/diary` section: you must be signed in AND an admin to
 * see anything underneath. Mirrors the guard in `src/app/admin/layout.tsx`,
 * and is backed server-side by `adminProcedure` on every diary tRPC call.
 */
export default async function DiaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    return (
      <main className="bg-gms-cream flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <header className="text-center">
            <p className="text-gms-rose m-0 mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
              Secret Love Diary
            </p>
            <h1 className="text-gms-ink m-0 font-serif text-[32px] font-semibold">
              Sign in
            </h1>
          </header>
          <AuthForm />
        </div>
      </main>
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return (
      <main className="bg-gms-cream flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-gms-ink font-serif text-2xl font-semibold">
            No access
          </h1>
          <p className="text-gms-stone mt-3 text-sm">
            Signed in as <strong>{session.user?.email}</strong>, but the Love
            Diary is admins only.
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </main>
    );
  }

  return <div className="bg-gms-cream min-h-screen">{children}</div>;
}
