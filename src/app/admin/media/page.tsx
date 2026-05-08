import { MediaLibrary } from "~/app/admin/_components/media-library";
import { api } from "~/trpc/server";

export const metadata = { title: "Media — Admin" };

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const sp = await searchParams;
  const initial = await api.admin.listMedia({
    cursor: sp.cursor,
    limit: 50,
  });
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Media</h1>
      </header>
      <MediaLibrary
        initial={initial}
        uploadsBaseUrl={process.env.NEXT_PUBLIC_UPLOADS_BASE_URL ?? ""}
      />
    </main>
  );
}
