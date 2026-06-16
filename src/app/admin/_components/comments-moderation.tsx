"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "~/trpc/react";

type Filter = "recent" | "pending" | "spam" | "approved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "pending", label: "Pending" },
  { key: "spam", label: "Flagged / spam" },
  { key: "approved", label: "Approved" },
];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  spam: "bg-rose-50 text-rose-600",
};

export function CommentsModeration() {
  const [filter, setFilter] = useState<Filter>("recent");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const utils = api.useUtils();

  const list = api.comment.listForAdmin.useQuery({
    status: filter === "recent" ? undefined : filter,
  });

  const refresh = async () => {
    await utils.comment.listForAdmin.invalidate();
  };

  const moderate = api.comment.moderate.useMutation({ onSuccess: refresh });
  const blockIp = api.comment.blockIp.useMutation({
    onSuccess: async () => {
      await utils.comment.listBlockedIps.invalidate();
    },
  });
  const reply = api.comment.reply.useMutation({
    onSuccess: async () => {
      setReplyTo(null);
      setReplyBody("");
      await refresh();
    },
  });

  const rows = list.data ?? [];

  const submitReply = (parentId: number) => {
    if (!replyBody.trim()) return;
    reply.mutate({ parentId, body: replyBody });
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.key
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reply.error && (
        <p className="mt-4 text-sm text-rose-600">{reply.error.message}</p>
      )}

      {list.isLoading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">Nothing here.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="text-neutral-600">
                  <span className="font-semibold text-neutral-900">
                    {c.userName ?? c.guestName ?? "Anonymous"}
                  </span>
                  {c.guestEmail && (
                    <span className="text-neutral-400"> · {c.guestEmail}</span>
                  )}
                  <span className="text-neutral-400">
                    {" · "}
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.spamReason && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                      {c.spamReason}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_STYLES[c.status] ??
                      "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm whitespace-pre-wrap text-neutral-800">
                {c.body}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/${c.postSlug}`}
                  className="text-neutral-400 hover:underline"
                  target="_blank"
                >
                  on “{c.postTitle}”
                </Link>
                <span className="flex-1" />
                <button
                  onClick={() => {
                    setReplyTo((id) => (id === c.id ? null : c.id));
                    setReplyBody("");
                  }}
                  className="rounded bg-neutral-900 px-3 py-1 font-medium text-white hover:bg-neutral-700"
                >
                  {replyTo === c.id ? "Cancel" : "Reply"}
                </button>
                {c.status !== "approved" && (
                  <button
                    onClick={() =>
                      moderate.mutate({ id: c.id, action: "approve" })
                    }
                    disabled={moderate.isPending}
                    className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {c.status !== "spam" && (
                  <button
                    onClick={() =>
                      moderate.mutate({ id: c.id, action: "spam" })
                    }
                    disabled={moderate.isPending}
                    className="rounded bg-neutral-200 px-3 py-1 font-medium text-neutral-700 hover:bg-neutral-300 disabled:opacity-50"
                  >
                    Mark spam
                  </button>
                )}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Block this commenter's IP from posting again?",
                      )
                    ) {
                      blockIp.mutate({ commentId: c.id });
                    }
                  }}
                  disabled={!c.ipHash || blockIp.isPending}
                  title={
                    c.ipHash
                      ? "Block this IP from commenting"
                      : "No IP recorded for this comment"
                  }
                  className="rounded px-3 py-1 font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                >
                  Block IP
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Delete this comment permanently?")) {
                      moderate.mutate({ id: c.id, action: "delete" });
                    }
                  }}
                  disabled={moderate.isPending}
                  className="rounded px-3 py-1 font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>

              {replyTo === c.id && (
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <textarea
                    autoFocus
                    rows={3}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a public reply…"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => submitReply(c.id)}
                      disabled={reply.isPending || !replyBody.trim()}
                      className="rounded bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                    >
                      {reply.isPending ? "Posting…" : "Post reply"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
