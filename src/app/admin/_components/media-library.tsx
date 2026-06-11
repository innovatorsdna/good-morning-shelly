"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

interface MediaObject {
  key: string;
  publicPath: string;
  size: number;
  lastModified: string | null;
}

interface InitialPayload {
  objects: MediaObject[];
  nextCursor: string | null;
}

interface Props {
  initial: InitialPayload;
  uploadsBaseUrl: string;
  /** Surfaced when the initial server-side load failed (e.g. S3 unreachable). */
  loadError?: string | null;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function rewrite(uploadsBase: string, publicPath: string): string {
  if (uploadsBase && publicPath.startsWith("/uploads/")) {
    return uploadsBase.replace(/\/$/, "") + publicPath;
  }
  return publicPath;
}

export function MediaLibrary({ initial, uploadsBaseUrl, loadError }: Props) {
  const [objects, setObjects] = useState<MediaObject[]>(initial.objects);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [copied, setCopied] = useState<string | null>(null);

  const utils = api.useUtils();
  const remove = api.admin.deleteMedia.useMutation();
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = async () => {
    if (!cursor) return;
    setError(null);
    setLoadingMore(true);
    try {
      const next = await utils.admin.listMedia.fetch({ cursor, limit: 50 });
      setObjects((prev) => [...prev, ...next.objects]);
      setCursor(next.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const onCopy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(path);
      setTimeout(() => setCopied((c) => (c === path ? null : c)), 1500);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  const onDelete = async (obj: MediaObject) => {
    if (!window.confirm(`Delete ${obj.key}?`)) return;
    setError(null);
    try {
      await remove.mutateAsync({ key: obj.key });
      setObjects((prev) => prev.filter((o) => o.key !== obj.key));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {objects.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          No uploads yet. Add an image from the post editor and it&apos;ll appear here.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {objects.map((obj) => {
            const isImage = IMAGE_EXTENSIONS.test(obj.key);
            const url = rewrite(uploadsBaseUrl, obj.publicPath);
            return (
              <li
                key={obj.key}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <div className="aspect-square bg-neutral-100">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                      file
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <p
                    className="truncate font-mono text-[10px] text-neutral-500"
                    title={obj.key}
                  >
                    {obj.key.split("/").pop()}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {formatSize(obj.size)}
                    {obj.lastModified && (
                      <>
                        {" · "}
                        {new Date(obj.lastModified).toLocaleDateString()}
                      </>
                    )}
                  </p>
                  <div className="flex gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => void onCopy(obj.publicPath)}
                      className="flex-1 rounded border border-neutral-200 px-2 py-1 text-[11px] hover:bg-neutral-100"
                    >
                      {copied === obj.publicPath ? "Copied!" : "Copy URL"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(obj)}
                      disabled={remove.isPending}
                      className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cursor && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
