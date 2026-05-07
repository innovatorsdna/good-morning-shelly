import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/_components/auth-form";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

export const metadata = { title: "Admin — Good Morning Shelly" };

export default async function AdminPage() {
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
  const isAdmin = role === "admin";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Signed in as {session.user?.email}
            {role && <span className="ml-2 text-neutral-400">({role})</span>}
          </p>
        </div>
        <form>
          <button
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
            formAction={async () => {
              "use server";
              await auth.api.signOut({ headers: await headers() });
              redirect("/admin");
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      {isAdmin ? (
        <section className="mt-8 space-y-4">
          <p className="text-neutral-700">
            Welcome. Post management lands in the next change.
          </p>
          <ul className="list-disc pl-6 text-neutral-700">
            <li>
              <Link href="/" className="underline underline-offset-4">
                Back to site
              </Link>
            </li>
          </ul>
        </section>
      ) : (
        <section className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">You don&apos;t have admin access.</p>
          <p className="mt-1 text-sm">
            To grant access, run against the database:
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-amber-100 p-2 text-xs">
            UPDATE user SET role = &apos;admin&apos; WHERE email = &apos;
            {session.user?.email}&apos;;
          </pre>
        </section>
      )}
    </main>
  );
}
