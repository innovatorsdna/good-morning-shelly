"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { uploadsUrl } from "~/lib/uploads";
import { api } from "~/trpc/react";

export function DiaryComposer() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presign = api.diary.presignUpload.useMutation();
  const utils = api.useUtils();
  const create = api.diary.create.useMutation({
    onSuccess: async () => {
      await utils.diary.feed.invalidate();
      router.push("/diary");
    },
    onError: (err) => setError(err.message),
  });

  const onPickFile = async (file: File) => {
    setError(null);
    // Local preview while we upload.
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { uploadUrl, publicPath } = await presign.mutateAsync({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setImagePath(publicPath);
    } catch (err) {
      setError((err as Error).message ?? "Upload failed");
      setPreview(null);
      setImagePath(null);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePath && !caption.trim()) {
      setError("Add a photo or write a message.");
      return;
    }
    create.mutate({ image: imagePath, caption });
  };

  // A post needs either a photo or a caption; block submit only while an upload
  // is still in flight or nothing has been entered yet.
  const canPost = (!!imagePath || caption.trim().length > 0) && !uploading;

  const displaySrc = imagePath ? uploadsUrl(imagePath) : preview;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[600px] flex-col">
      <header className="border-gms-line bg-gms-cream/95 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <Link href="/diary" className="text-gms-stone text-sm">
          Cancel
        </Link>
        <h1 className="text-gms-ink font-serif text-lg font-semibold">
          New love note
        </h1>
        <button
          type="submit"
          form="diary-composer"
          disabled={!canPost || create.isPending}
          className="bg-gms-rose rounded-full px-4 py-1.5 text-[12px] font-bold tracking-[0.1em] text-white uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {create.isPending ? "Posting…" : "Post"}
        </button>
      </header>

      <form
        id="diary-composer"
        onSubmit={onSubmit}
        className="flex flex-1 flex-col gap-4 p-4"
      >
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {displaySrc ? (
          <div className="border-gms-line bg-gms-panel relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt="Selected"
              className="h-full w-full object-cover"
            />
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
                Uploading…
              </span>
            )}
            {!uploading && (
              <div className="absolute right-2 bottom-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                >
                  📷 Camera
                </button>
                <button
                  type="button"
                  onClick={() => libraryInputRef.current?.click()}
                  className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                >
                  🖼️ Library
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setImagePath(null);
                    setError(null);
                  }}
                  className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-gms-line bg-gms-panel flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed">
            <span className="text-gms-muted text-sm">Add a photo (optional)</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="border-gms-line text-gms-ink hover:bg-gms-cream flex flex-col items-center gap-1 rounded-lg border bg-white px-5 py-3 text-sm font-medium transition-colors"
              >
                <span className="text-2xl">📷</span>
                Camera
              </button>
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                className="border-gms-line text-gms-ink hover:bg-gms-cream flex flex-col items-center gap-1 rounded-lg border bg-white px-5 py-3 text-sm font-medium transition-colors"
              >
                <span className="text-2xl">🖼️</span>
                Library
              </button>
            </div>
          </div>
        )}

        {/* `capture` opens the camera directly; the plain input opens the photo library. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickFile(file);
            e.target.value = "";
          }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickFile(file);
            e.target.value = "";
          }}
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption…"
          rows={4}
          maxLength={2000}
          className="border-gms-line text-gms-ink placeholder:text-gms-muted focus:border-gms-sage w-full rounded-md border bg-white px-3 py-2 text-[15px] focus:outline-none"
        />
      </form>
    </div>
  );
}
