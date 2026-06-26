"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { TiptapEditor } from "~/app/admin/_components/tiptap-editor";
import { slugify } from "~/lib/slug";
import { uploadsUrl } from "~/lib/uploads";
import { api } from "~/trpc/react";

type Status = "publish" | "draft";
type ContentType = "post" | "page";

export interface PostFormInitial {
  id: number;
  type: ContentType;
  title: string;
  slug: string;
  body: string;
  status: Status;
  isPrivate: boolean;
  excerpt: string | null;
  cover: string | null;
  sticky: boolean;
  publishedAt: Date | null;
  categories: string[];
}

interface Props {
  type: ContentType;
  initial: PostFormInitial | null;
}

const AUTOSAVE_MS = 3000;

export function PostForm({ type, initial }: Props) {
  const router = useRouter();
  const isEdit = initial !== null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [status, setStatus] = useState<Status>(initial?.status ?? "draft");
  // Audience for posts. New posts default to members-only; pages are always
  // public so this control is hidden for them.
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? true);
  const [body, setBody] = useState(initial?.body ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [cover, setCover] = useState(initial?.cover ?? "");
  const [sticky, setSticky] = useState(initial?.sticky ?? false);
  const [categories, setCategories] = useState<string>(
    (initial?.categories ?? []).join(", "),
  );
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(
    initial?.publishedAt ?? null,
  );

  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const create = api.admin.create.useMutation();
  const update = api.admin.update.useMutation();
  const autosave = api.admin.autosave.useMutation();
  const del = api.admin.delete.useMutation();
  const presign = api.admin.presignUpload.useMutation();

  const uploadCover = async (file: File) => {
    setCoverError(null);
    setCoverUploading(true);
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
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }
      setCover(publicPath);
    } catch (err) {
      setCoverError((err as Error).message ?? "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const onPickCover = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void uploadCover(file);
    };
    input.click();
  };

  const parsedCategories = useMemo(
    () =>
      categories
        .split(",")
        .map((c) => slugify(c.trim()))
        .filter(Boolean),
    [categories],
  );

  // Auto-suggest slug from title until the user manually edits it.
  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(title));
  }, [title, slugTouched]);

  // Autosave (edit mode only): debounce body+excerpt changes.
  const lastSavedBodyRef = useRef<string>(initial?.body ?? "");
  const lastSavedExcerptRef = useRef<string>(initial?.excerpt ?? "");
  useEffect(() => {
    if (!isEdit || !initial) return;
    const id = window.setTimeout(() => {
      if (
        body === lastSavedBodyRef.current &&
        excerpt === lastSavedExcerptRef.current
      ) {
        return;
      }
      autosave.mutate(
        { id: initial.id, body, excerpt: excerpt || null },
        {
          onSuccess: ({ savedAt }) => {
            lastSavedBodyRef.current = body;
            lastSavedExcerptRef.current = excerpt;
            setSavedAt(new Date(savedAt));
          },
        },
      );
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, excerpt, isEdit, initial?.id]);

  // Warn before unload if there are unsaved changes (edit only).
  useEffect(() => {
    if (!isEdit) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (
        body !== lastSavedBodyRef.current ||
        excerpt !== lastSavedExcerptRef.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [body, excerpt, isEdit]);

  const submit = async () => {
    setError(null);
    const payload = {
      type,
      title,
      slug,
      status,
      isPrivate,
      body,
      excerpt: excerpt || null,
      cover: cover || null,
      sticky,
      categories: parsedCategories,
      publishedAt: initial?.publishedAt ?? null,
    };
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, ...payload });
        lastSavedBodyRef.current = body;
        lastSavedExcerptRef.current = excerpt;
        setSavedAt(new Date());
        router.refresh();
      } else {
        const { id } = await create.mutateAsync(payload);
        const target =
          type === "post" ? `/admin/posts/${id}/edit` : `/admin/pages/${id}/edit`;
        router.push(target);
      }
    } catch (err) {
      setError((err as Error).message ?? "Save failed");
    }
  };

  const remove = async () => {
    if (!isEdit || !initial) return;
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await del.mutateAsync({ id: initial.id });
      router.push(type === "post" ? "/admin/posts" : "/admin/pages");
    } catch (err) {
      setError((err as Error).message ?? "Delete failed");
    }
  };

  const submitting = create.isPending || update.isPending;

  const previewSrc =
    isEdit && initial
      ? type === "post"
        ? `/admin/posts/${initial.id}/preview`
        : `/admin/pages/${initial.id}/preview`
      : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? "Edit" : "New"} {type}
        </h1>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          {autosave.isPending && <span>Saving…</span>}
          {!autosave.isPending && savedAt && (
            <span>Saved {savedAt.toLocaleTimeString()}</span>
          )}
          {isEdit && (
            <button
              type="button"
              onClick={remove}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-2xl font-semibold focus:border-neutral-400 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 border-b border-neutral-200 text-sm">
            <button
              type="button"
              onClick={() => setTab("editor")}
              className={`-mb-px border-b-2 px-3 py-2 font-medium ${
                tab === "editor"
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              disabled={!previewSrc}
              className={`-mb-px border-b-2 px-3 py-2 font-medium ${
                tab === "preview"
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              } disabled:opacity-50`}
              title={previewSrc ? "" : "Save once to enable preview"}
            >
              Preview
            </button>
          </div>

          {tab === "editor" && (
            <TiptapEditor
              initialMarkdown={initial?.body ?? ""}
              onChange={setBody}
            />
          )}

          {tab === "preview" && previewSrc && (
            <iframe
              key={savedAt?.getTime() ?? 0}
              src={previewSrc}
              className="min-h-[600px] w-full rounded-lg border border-neutral-200 bg-white"
            />
          )}
        </div>

        <aside className="space-y-4 text-sm">
          <Field label="Slug">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="post-slug"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
              />
              {!slugTouched && title && (
                <span className="text-xs text-neutral-400" title="Auto from title">
                  auto
                </span>
              )}
            </div>
          </Field>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="publish">Published</option>
            </select>
          </Field>

          {type === "post" && (
            <Field label="Visibility">
              <select
                value={isPrivate ? "private" : "public"}
                onChange={(e) => setIsPrivate(e.target.value === "private")}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
              >
                <option value="private">Members only</option>
                <option value="public">Public</option>
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                {isPrivate
                  ? "Only signed-in members can read this once published."
                  : "Anyone can read this once published."}
              </p>
            </Field>
          )}

          {type === "post" && (
            <Field label="Categories">
              <input
                type="text"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="comma, separated, slugs"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs focus:border-neutral-400 focus:outline-none"
              />
              {parsedCategories.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {parsedCategories.map((c) => (
                    <span
                      key={c}
                      className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </Field>
          )}

          <Field label="Cover image">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploadsUrl(cover) ?? cover}
                alt="Cover preview"
                className="mb-2 aspect-video w-full rounded-md border border-neutral-200 object-cover"
              />
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="/uploads/2026/05/foo.jpg"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs focus:border-neutral-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={onPickCover}
                disabled={coverUploading}
                className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
              >
                {coverUploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            {cover && !coverUploading && (
              <button
                type="button"
                onClick={() => setCover("")}
                className="mt-1 text-xs text-neutral-400 hover:text-neutral-600"
              >
                Remove
              </button>
            )}
            {coverError && (
              <p className="mt-1 text-xs text-red-600">{coverError}</p>
            )}
          </Field>

          <Field label="Excerpt">
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Short summary for archive listings."
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
            />
          </Field>

          {type === "post" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sticky}
                onChange={(e) => setSticky(e.target.checked)}
              />
              <span>Sticky</span>
            </label>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
