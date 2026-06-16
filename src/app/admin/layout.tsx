import { AuthForm } from "~/app/_components/auth-form";
import { AdminShell } from "~/app/admin/_components/admin-shell";
import { SignOutButton } from "~/app/admin/_components/sign-out-button";
import { getSession } from "~/server/better-auth/server";

export const metadata = { title: "Admin — Good Morning Shelly" };

export default async function AdminLayout({
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
              Good Morning Shelly
            </p>
            <h1 className="text-gms-ink m-0 font-serif text-[32px] font-semibold">
              Admin sign in
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
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold">No admin access</h1>
        <p className="mt-3 text-neutral-700">
          Signed in as <strong>{session.user?.email}</strong>, but this account
          isn&apos;t an admin.
        </p>
        <p className="mt-3 text-sm text-neutral-600">
          To grant access, run against the database:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-3 text-xs">
          UPDATE user SET role = &apos;admin&apos; WHERE email = &apos;
          {session.user?.email}&apos;;
        </pre>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </main>
    );
  }

  return <AdminShell email={session.user?.email}>{children}</AdminShell>;
}
