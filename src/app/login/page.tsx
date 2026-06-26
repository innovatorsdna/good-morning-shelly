import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "~/app/_components/auth-form";
import { getSession } from "~/server/better-auth/server";

export const metadata = { title: "Sign in — Good Morning Shelly" };

/**
 * Only allow redirects back to internal paths, so `?next=` can't be used to
 * bounce a freshly signed-in user off to an arbitrary external site.
 */
function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);

  // Already signed in? Skip the form and go where they were headed.
  const session = await getSession();
  if (session) redirect(destination);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <header className="text-center">
          <p className="m-0 mb-2 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
            Good Morning Shelly
          </p>
          <h1 className="m-0 font-serif text-[32px] font-semibold text-gms-ink">
            Hello friend.
          </h1>
          <p className="m-0 mt-3 text-[13px] leading-[1.6] text-gms-stone">
            This is a blog for nice people. If you are nice <i>and</i> human, I would love for you to join. Just click on the contact button below and I&apos;ll send you a key. Otherwise, feel free to{" "}
            <Link href="/" className="text-gms-sage hover:underline">
              keep browsing
            </Link>
            .
          </p>
        </header>
        <AuthForm redirectTo={destination} />
      </div>
    </main>
  );
}
