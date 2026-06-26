"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatPostDate } from "~/lib/format";
import { api } from "~/trpc/react";

export interface PostRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  isPrivate: boolean;
  source: string;
  publishedAt: string | null;
  type: string;
}

interface Props {
  rows: PostRow[];
  type: "post" | "page";
}

export function PostsListTable({ rows, type }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const updateStatus = api.admin.bulkUpdateStatus.useMutation();
  const setVisibility = api.admin.bulkSetVisibility.useMutation();
  const bulkDelete = api.admin.bulkDelete.useMutation();
  const basePath = type === "post" ? "/admin/posts" : "/admin/pages";

  // Rows the bulk toolbar can act on. In the posts view every post is
  // selectable — including archived MDX posts, whose one permitted edit is
  // flipping visibility (make public / members only). In the pages view only
  // non-archived pages are selectable, since pages have no visibility action
  // and archived content can't be published or deleted.
  const canSelect = (r: PostRow) => (type === "post" ? true : r.source !== "mdx");
  const selectable = useMemo(
    () => rows.filter((r) => (type === "post" ? true : r.source !== "mdx")),
    [rows, type],
  );
  const allSelectableSelected =
    selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const anyChecked = selected.size > 0;

  const toggleAll = () => {
    if (allSelectableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((r) => r.id)));
    }
  };

  const toggleOne = (id: number, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runStatus = async (status: "publish" | "draft") => {
    if (selected.size === 0) return;
    setError(null);
    setNotice(null);
    try {
      const res = await updateStatus.mutateAsync({
        ids: [...selected],
        status,
      });
      setSelected(new Set());
      if (res.skipped > 0) {
        setNotice(
          `${res.updated} updated · ${res.skipped} skipped (archived posts are read-only — only their visibility can change).`,
        );
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const runVisibility = async (isPrivate: boolean) => {
    if (selected.size === 0) return;
    setError(null);
    setNotice(null);
    try {
      const res = await setVisibility.mutateAsync({
        ids: [...selected],
        isPrivate,
      });
      setSelected(new Set());
      if (res.skipped > 0) {
        setNotice(`${res.updated} updated · ${res.skipped} skipped.`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const runDelete = async () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} ${
          selected.size === 1
            ? type === "post"
              ? "post"
              : "page"
            : type === "post"
              ? "posts"
              : "pages"
        }? This can't be undone.`,
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      const res = await bulkDelete.mutateAsync({ ids: [...selected] });
      setSelected(new Set());
      if (res.skipped > 0) {
        setNotice(
          `${res.deleted} deleted · ${res.skipped} skipped (archived posts are read-only).`,
        );
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const busy =
    updateStatus.isPending || setVisibility.isPending || bulkDelete.isPending;
  // Pages are always public, so visibility actions only apply to posts.
  const showVisibility = type === "post";

  return (
    <>
      <div
        className={`mt-4 flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm transition ${
          anyChecked ? "" : "opacity-50"
        }`}
      >
        <span className="text-neutral-600">
          {selected.size} selected
        </span>
        <button
          type="button"
          disabled={!anyChecked || busy}
          onClick={() => void runStatus("publish")}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={!anyChecked || busy}
          onClick={() => void runStatus("draft")}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
        >
          Move to draft
        </button>
        {showVisibility && (
          <>
            <button
              type="button"
              disabled={!anyChecked || busy}
              onClick={() => void runVisibility(true)}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
            >
              Members only
            </button>
            <button
              type="button"
              disabled={!anyChecked || busy}
              onClick={() => void runVisibility(false)}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
            >
              Make public
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!anyChecked || busy}
          onClick={() => void runDelete()}
          className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {notice}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  disabled={selectable.length === 0}
                  checked={allSelectableSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  No {type === "post" ? "posts" : "pages"} found.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const archived = r.source === "mdx";
              const selectableRow = canSelect(r);
              return (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2 align-middle">
                    {selectableRow ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.title}`}
                        checked={selected.has(r.id)}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                      />
                    ) : (
                      <span
                        title="Archived pages are read-only"
                        className="text-xs text-neutral-300"
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {r.title || <em>(untitled)</em>}
                    </div>
                    <a
                      href={`/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
                    >
                      /{r.slug}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={r.status}
                      source={r.source}
                      isPrivate={r.isPrivate}
                      type={r.type}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {r.publishedAt ? formatPostDate(r.publishedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {archived ? (
                      <span className="text-xs text-neutral-400">read-only</span>
                    ) : (
                      <Link
                        href={`${basePath}/${r.id}/edit`}
                        className="text-sm text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                      >
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusBadge({
  status,
  source,
  isPrivate,
  type,
}: {
  status: string;
  source: string;
  isPrivate: boolean;
  type: string;
}) {
  const cls =
    status === "publish"
      ? "bg-green-100 text-green-800"
      : "bg-neutral-200 text-neutral-700";
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
        {status}
      </span>
      {type === "post" && (
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            isPrivate
              ? "bg-amber-100 text-amber-800"
              : "bg-sky-100 text-sky-800"
          }`}
        >
          {isPrivate ? "members" : "public"}
        </span>
      )}
      {source === "mdx" && (
        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          archived
        </span>
      )}
    </div>
  );
}
