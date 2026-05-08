"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { slugify } from "~/lib/slug";
import { api } from "~/trpc/react";

interface CategoryRow {
  slug: string;
  name: string;
  count: number;
}

export function CategoriesManager({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<CategoryRow[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = api.admin.createCategory.useMutation();
  const rename = api.admin.renameCategory.useMutation();
  const remove = api.admin.deleteCategory.useMutation();
  const merge = api.admin.mergeCategory.useMutation();

  const refresh = () => router.refresh();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const rawName = fd.get("name");
    const rawSlug = fd.get("slug");
    const name = (typeof rawName === "string" ? rawName : "").trim();
    const slugInput = typeof rawSlug === "string" ? rawSlug : "";
    const slug = slugify(slugInput || name);
    if (!name || !slug) {
      setError("Name and slug are required.");
      return;
    }
    try {
      await create.mutateAsync({ slug, name });
      setRows((rs) => [...rs, { slug, name, count: 0 }].sort((a, b) =>
        a.slug < b.slug ? -1 : 1,
      ));
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEdit = (row: CategoryRow) => {
    setEditing(row.slug);
    setDraftName(row.name);
    setMerging(null);
  };

  const saveEdit = async (row: CategoryRow) => {
    setError(null);
    if (!draftName.trim()) {
      setEditing(null);
      return;
    }
    try {
      await rename.mutateAsync({ slug: row.slug, name: draftName.trim() });
      setRows((rs) =>
        rs.map((r) => (r.slug === row.slug ? { ...r, name: draftName.trim() } : r)),
      );
      setEditing(null);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onDelete = async (row: CategoryRow) => {
    setError(null);
    if (
      !window.confirm(
        `Delete category "${row.name}" (${row.slug})? ${row.count} ${
          row.count === 1 ? "post" : "posts"
        } will lose this tag.`,
      )
    )
      return;
    try {
      await remove.mutateAsync({ slug: row.slug });
      setRows((rs) => rs.filter((r) => r.slug !== row.slug));
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startMerge = (row: CategoryRow) => {
    setMerging(row.slug);
    setMergeTarget("");
    setEditing(null);
  };

  const doMerge = async (row: CategoryRow) => {
    setError(null);
    if (!mergeTarget || mergeTarget === row.slug) {
      setError("Pick a different target.");
      return;
    }
    try {
      const { moved } = await merge.mutateAsync({
        from: row.slug,
        to: mergeTarget,
      });
      setRows((rs) =>
        rs
          .filter((r) => r.slug !== row.slug)
          .map((r) =>
            r.slug === mergeTarget ? { ...r, count: r.count + moved } : r,
          ),
      );
      setMerging(null);
      setMergeTarget("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
            Display name
          </span>
          <input
            name="name"
            type="text"
            placeholder="Faith"
            className="w-56 rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
            Slug (optional)
          </span>
          <input
            name="slug"
            type="text"
            placeholder="auto from name"
            className="w-56 rounded-md border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Add category
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Posts</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  No categories yet.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isEditing = editing === row.slug;
              const isMerging = merging === row.slug;
              return (
                <tr
                  key={row.slug}
                  className="border-b border-neutral-100 last:border-0 align-middle"
                >
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEdit(row);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="rounded-md border border-neutral-200 px-2 py-1 text-sm focus:border-neutral-400 focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium">{row.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {row.slug}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{row.count}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEdit(row)}
                            disabled={rename.isPending}
                            className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded-md border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : isMerging ? (
                        <>
                          <select
                            value={mergeTarget}
                            onChange={(e) => setMergeTarget(e.target.value)}
                            className="rounded-md border border-neutral-200 px-2 py-1 text-xs focus:border-neutral-400 focus:outline-none"
                          >
                            <option value="">→ merge into…</option>
                            {rows
                              .filter((r) => r.slug !== row.slug)
                              .map((r) => (
                                <option key={r.slug} value={r.slug}>
                                  {r.name} ({r.slug})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void doMerge(row)}
                            disabled={merge.isPending || !mergeTarget}
                            className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                          >
                            Merge
                          </button>
                          <button
                            type="button"
                            onClick={() => setMerging(null)}
                            className="rounded-md border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="text-xs text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => startMerge(row)}
                            className="text-xs text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                          >
                            Merge
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(row)}
                            className="text-xs text-red-700 underline underline-offset-4 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
