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
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
          <h1 className="text-4xl font-bold">Admin sign in</h1>
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
