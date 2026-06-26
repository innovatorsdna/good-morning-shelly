"use client";

import Link from "next/link";
import { useState } from "react";

import { uploadsUrl } from "~/lib/uploads";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  Heart, MessageCircle
} from "lucide-react";

type DiaryPost = RouterOutputs["diary"]["feed"]["posts"][number];

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
  const feed = api.diary.feed.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[600px] flex-col">
      {/* Sticky app bar */}
      <header className="border-gms-line bg-gms-cream/95 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <h1 className="text-gms-ink font-serif text-xl font-semibold">
          Secret Love Diary
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
            {posts.map((post) => (
              <DiaryPostCard key={post.id} post={post} />
            ))}
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

        {!feed.isLoading && !feed.isError && !feed.hasNextPage && posts.length > 0 && (
          <p className="text-gms-muted px-4 py-10 text-center font-serif text-sm">
            End of feed. But not the end of our love.
          </p>
        )}
      </main>
    </div>
  );
}

function DiaryPostCard({ post }: { post: DiaryPost }) {
  const utils = api.useUtils();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  // Heart taps are additive and optimistic — bump locally on every click and
  // fire the mutation; the server keeps the authoritative running total.
  const [likes, setLikes] = useState(post.likes);

  const del = api.diary.delete.useMutation({
    onSuccess: () => utils.diary.feed.invalidate(),
  });
  const update = api.diary.update.useMutation({
    onSuccess: async () => {
      await utils.diary.feed.invalidate();
      setEditing(false);
    },
  });
  const like = api.diary.like.useMutation();
  const addComment = api.diary.addComment.useMutation({
    onSuccess: async () => {
      setCommentBody("");
      await Promise.all([
        utils.diary.comments.invalidate({ postId: post.id }),
        utils.diary.feed.invalidate(),
      ]);
    },
  });

  const comments = api.diary.comments.useQuery(
    { postId: post.id },
    { enabled: showComments },
  );

  const author = post.author?.name ?? post.author?.email ?? "You";
  const src = uploadsUrl(post.image);

  const onLike = () => {
    setLikes((n) => n + 1);
    like.mutate({ id: post.id });
  };

  return (
    <li className="border-gms-line overflow-hidden border-y bg-white sm:rounded-xl sm:border">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-gms-ink text-sm font-semibold">{author}</span>
        <div className="flex items-center gap-3">
          <span className="text-gms-muted text-xs">
            {timeAgo(new Date(post.createdAt))}
          </span>
          {confirmingDelete ? (
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
                onClick={() => setConfirmingDelete(false)}
                className="text-gms-muted"
              >
                Cancel
              </button>
            </span>
          ) : menuOpen ? (
            <span className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEditCaption(post.caption ?? "");
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="text-gms-ink font-semibold"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(true);
                  setMenuOpen(false);
                }}
                className="font-semibold text-red-600"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-gms-muted"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Post options"
              className="text-gms-muted hover:text-gms-ink text-lg leading-none"
            >
              ⋯
            </button>
          )}
        </div>
      </div>

      {src && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={post.caption ?? ""}
          className="bg-gms-panel block w-full object-cover"
        />
      )}

      {/* Action bar: heart + count, comment toggle + count */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          type="button"
          onClick={onLike}
          aria-label="Like"
          className="text-gms-rose flex items-center gap-1.5 transition-transform active:scale-125"
        >
          <Heart className="w-4 h-4" strokeWidth={2}/>
          <span className="text-gms-ink text-sm font-semibold tabular-nums">
            {likes}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-label="Comments"
          className="text-gms-stone hover:text-gms-ink flex items-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={2}/>
          <span className="text-gms-ink text-sm font-semibold tabular-nums">
            {post.commentCount}
          </span>
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 px-4 py-3">
          <textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Write a caption…"
            className="border-gms-line text-gms-ink placeholder:text-gms-muted focus:border-gms-sage w-full rounded-md border bg-white px-3 py-2 text-[15px] focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-gms-muted px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                update.mutate({ id: post.id, caption: editCaption })
              }
              disabled={update.isPending}
              className="bg-gms-rose rounded-full px-4 py-1.5 text-[12px] font-bold tracking-[0.1em] text-white uppercase disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        post.caption && (
          <p className="text-gms-ink px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
            {post.caption}
          </p>
        )
      )}

      {showComments && (
        <div className="border-gms-line flex flex-col gap-3 border-t px-4 py-3">
          {comments.isLoading ? (
            <p className="text-gms-muted text-sm">Loading comments…</p>
          ) : comments.data && comments.data.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {comments.data.map((c) => (
                <DiaryCommentRow key={c.id} comment={c} postId={post.id} />
              ))}
            </ul>
          ) : (
            <p className="text-gms-muted text-sm">No comments yet.</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body = commentBody.trim();
              if (!body) return;
              addComment.mutate({ postId: post.id, body });
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              maxLength={2000}
              className="border-gms-line text-gms-ink placeholder:text-gms-muted focus:border-gms-sage flex-1 rounded-full border bg-white px-3 py-1.5 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || addComment.isPending}
              className="text-gms-rose text-sm font-bold disabled:opacity-40"
            >
              {addComment.isPending ? "…" : "Post"}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

function DiaryCommentRow({
  comment,
  postId,
}: {
  comment: RouterOutputs["diary"]["comments"][number];
  postId: number;
}) {
  const utils = api.useUtils();
  const del = api.diary.deleteComment.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.diary.comments.invalidate({ postId }),
        utils.diary.feed.invalidate(),
      ]);
    },
  });

  const author = comment.author?.name ?? comment.author?.email ?? "You";

  return (
    <li className="group flex items-start justify-between gap-2 text-sm">
      <p className="text-gms-ink leading-relaxed">
        <span className="font-semibold">{author}</span>{" "}
        <span className="whitespace-pre-wrap">{comment.body}</span>
      </p>
      <button
        type="button"
        onClick={() => del.mutate({ id: comment.id })}
        disabled={del.isPending}
        aria-label="Delete comment"
        className="text-gms-muted shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 disabled:opacity-50"
      >
        ×
      </button>
    </li>
  );
}
