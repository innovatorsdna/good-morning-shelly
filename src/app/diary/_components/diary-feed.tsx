"use client";

import Link from "next/link";
import { useState } from "react";

import { uploadsUrl } from "~/lib/uploads";
import { api } from "~/trpc/react";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let value = seconds;
  let unit = "s";
  let divisor = 1;
  for (const [step, label] of units) {
    if (value < step) {
      unit = label;
      break;
    }
    divisor *= step;
    value = seconds / divisor;
    unit = label;
  }
  return `${Math.max(1, Math.floor(value))}${unit}`;
}

export function DiaryFeed() {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const utils = api.useUtils();
  const feed = api.diary.feed.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );
  const del = api.diary.delete.useMutation({
    onSuccess: () => utils.diary.feed.invalidate(),
  });

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[600px] flex-col">
      {/* Sticky app bar */}
      <header className="border-gms-line bg-gms-cream/95 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <h1 className="text-gms-ink font-serif text-xl font-semibold">
          Love Diary
        </h1>
        <Link
          href="/diary/new"
          className="bg-gms-rose rounded-full px-4 py-1.5 text-[12px] font-bold tracking-[0.1em] text-white uppercase transition-opacity hover:opacity-90"
        >
          + New
        </Link>
      </header>

      <main className="flex-1 pb-24">
        {feed.isLoading ? (
          <p className="text-gms-muted px-4 py-16 text-center text-sm">
            Loading…
          </p>
        ) : feed.isError ? (
          <p className="px-4 py-16 text-center text-sm text-red-600">
            Couldn&apos;t load the diary. {feed.error.message}
          </p>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-24 text-center">
            <p className="text-gms-stone text-sm">
              No moments yet. Add your first one.
            </p>
            <Link
              href="/diary/new"
              className="bg-gms-rose rounded-full px-5 py-2.5 text-[12px] font-bold tracking-[0.1em] text-white uppercase transition-opacity hover:opacity-90"
            >
              Create a post
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-6 py-4">
            {posts.map((post) => {
              const author = post.author?.name ?? post.author?.email ?? "You";
              const src = uploadsUrl(post.image);
              return (
                <li
                  key={post.id}
                  className="border-gms-line overflow-hidden border-y bg-white sm:rounded-xl sm:border"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-gms-ink text-sm font-semibold">
                      {author}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-gms-muted text-xs">
                        {timeAgo(new Date(post.createdAt))}
                      </span>
                      {confirmingId === post.id ? (
                        <span className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => del.mutate({ id: post.id })}
                            disabled={del.isPending}
                            className="font-semibold text-red-600 disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="text-gms-muted"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(post.id)}
                          aria-label="Post options"
                          className="text-gms-muted hover:text-gms-ink text-lg leading-none"
                        >
                          ⋯
                        </button>
                      )}
                    </div>
                  </div>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={post.caption ?? ""}
                    className="block w-full bg-gms-panel object-cover"
                  />

                  {post.caption && (
                    <p className="text-gms-ink px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
                      {post.caption}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {feed.hasNextPage && (
          <div className="flex justify-center py-6">
            <button
              type="button"
              onClick={() => void feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              className="border-gms-line text-gms-stone rounded-full border bg-white px-5 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {feed.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
