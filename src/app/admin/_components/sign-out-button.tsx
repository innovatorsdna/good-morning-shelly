import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/server/better-auth";

export function SignOutButton() {
  return (
    <form>
      <button
        className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        formAction={async () => {
          "use server";
          await auth.api.signOut({ headers: await headers() });
          redirect("/admin");
        }}
      >
        Sign out
      </button>
    </form>
  );
}
