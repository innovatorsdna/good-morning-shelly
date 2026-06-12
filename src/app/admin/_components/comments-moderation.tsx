"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "~/trpc/react";

type Filter = "spam" | "approved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "spam", label: "Flagged / spam" },
  { key: "approved", label: "Approved" },
];

export function CommentsModeration() {
  const [filter, setFilter] = useState<Filter>("spam");
  const utils = api.useUtils();
  const list = api.comment.listForAdmin.useQuery({ status: filter });

  const moderate = api.comment.moderate.useMutation({
    onSuccess: async () => {
      await utils.comment.listForAdmin.invalidate();
    },
  });

  const rows = list.data ?? [];

  return (
    <div className="mt-6">
      <div className="flex gap-2">
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
                {c.spamReason && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                    {c.spamReason}
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm whitespace-pre-wrap text-neutral-800">
                {c.body}
              </p>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <Link
                  href={`/${c.postSlug}`}
                  className="text-neutral-400 hover:underline"
                  target="_blank"
                >
                  on “{c.postTitle}”
                </Link>
                <span className="flex-1" />
                {filter !== "approved" && (
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
                {filter !== "spam" && (
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
                  onClick={() =>
                    moderate.mutate({ id: c.id, action: "delete" })
                  }
                  disabled={moderate.isPending}
                  className="rounded px-3 py-1 font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
