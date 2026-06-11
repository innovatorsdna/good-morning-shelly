import { MediaLibrary } from "~/app/admin/_components/media-library";
import { api } from "~/trpc/server";

export const metadata = { title: "Media — Admin" };

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const sp = await searchParams;

  // The media library lives in S3. If storage isn't configured or the bucket
  // can't be reached, render the page with an explanatory banner instead of
  // letting the whole route 500 with an opaque server-side exception.
  let initial: Awaited<ReturnType<typeof api.admin.listMedia>> = {
    objects: [],
    nextCursor: null,
  };
  let loadError: string | null = null;
  try {
    initial = await api.admin.listMedia({
      cursor: sp.cursor,
      limit: 50,
    });
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Couldn't load media from storage.";
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Media</h1>
      </header>
      <MediaLibrary
        initial={initial}
        uploadsBaseUrl={process.env.NEXT_PUBLIC_UPLOADS_BASE_URL ?? ""}
        loadError={loadError}
      />
    </main>
  );
}
