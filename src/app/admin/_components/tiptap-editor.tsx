"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";

import { api } from "~/trpc/react";

interface Props {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

export function TiptapEditor({ initialMarkdown, onChange, placeholder }: Props) {
  const presign = api.admin.presignUpload.useMutation();
  const initialRef = useRef(initialMarkdown);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: "rounded bg-neutral-100 p-3" } },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-blue-700 underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "max-w-full rounded" },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write your post…",
      }),
      Markdown.configure({
        html: false,
        breaks: false,
        linkify: true,
        transformPastedText: true,
      }),
    ],
    content: initialMarkdown,
    onUpdate: ({ editor: e }) => {
      const storage = e.storage as unknown as {
        markdown: { getMarkdown: () => string };
      };
      onChange(storage.markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none min-h-[300px] focus:outline-none px-4 py-3",
      },
    },
  });

  // Reset content when the initial markdown changes (e.g. switching to a
  // different post). Compares against the captured ref so we only do this
  // when the parent intentionally swaps it out.
  useEffect(() => {
    if (!editor) return;
    if (initialMarkdown !== initialRef.current) {
      initialRef.current = initialMarkdown;
      editor.commands.setContent(initialMarkdown);
    }
  }, [editor, initialMarkdown]);

  const uploadAndInsert = useCallback(
    async (file: File) => {
      if (!editor) return;
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
      editor
        .chain()
        .focus()
        .setImage({ src: publicPath, alt: file.name })
        .run();
    },
    [editor, presign],
  );

  const onPickImage = useCallback(() => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await uploadAndInsert(file);
      } catch (err) {
        console.error(err);
        alert(`Image upload failed: ${(err as Error).message}`);
      }
    };
    input.click();
  }, [editor, uploadAndInsert]);

  // Drop and paste image handlers
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      e.preventDefault();
      void Promise.all(files.map((f) => uploadAndInsert(f))).catch((err) => {
        console.error(err);
        alert(`Image upload failed: ${(err as Error).message}`);
      });
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .map((it) => (it.kind === "file" ? it.getAsFile() : null))
        .filter((f): f is File => !!f && f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      void Promise.all(files.map((f) => uploadAndInsert(f))).catch((err) => {
        console.error(err);
        alert(`Image upload failed: ${(err as Error).message}`);
      });
    };
    dom.addEventListener("drop", onDrop);
    dom.addEventListener("paste", onPaste);
    return () => {
      dom.removeEventListener("drop", onDrop);
      dom.removeEventListener("paste", onPaste);
    };
  }, [editor, uploadAndInsert]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <Toolbar editor={editor} onPickImage={onPickImage} uploading={presign.isPending} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  onPickImage,
  uploading,
}: {
  editor: Editor | null;
  onPickImage: () => void;
  uploading: boolean;
}) {
  if (!editor) return null;
  const btn = (
    label: string,
    cmd: () => boolean,
    active?: boolean,
    disabled?: boolean,
  ) => (
    <button
      type="button"
      onClick={cmd}
      disabled={disabled}
      className={`rounded px-2 py-1 text-sm font-medium ${
        active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
      } disabled:opacity-50`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      {btn(
        "B",
        () => editor.chain().focus().toggleBold().run(),
        editor.isActive("bold"),
      )}
      {btn(
        "I",
        () => editor.chain().focus().toggleItalic().run(),
        editor.isActive("italic"),
      )}
      {btn(
        "S",
        () => editor.chain().focus().toggleStrike().run(),
        editor.isActive("strike"),
      )}
      <span className="mx-1 h-5 w-px bg-neutral-200" />
      {btn(
        "H2",
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        editor.isActive("heading", { level: 2 }),
      )}
      {btn(
        "H3",
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        editor.isActive("heading", { level: 3 }),
      )}
      <span className="mx-1 h-5 w-px bg-neutral-200" />
      {btn(
        "•",
        () => editor.chain().focus().toggleBulletList().run(),
        editor.isActive("bulletList"),
      )}
      {btn(
        "1.",
        () => editor.chain().focus().toggleOrderedList().run(),
        editor.isActive("orderedList"),
      )}
      {btn(
        "❝",
        () => editor.chain().focus().toggleBlockquote().run(),
        editor.isActive("blockquote"),
      )}
      {btn(
        "</>",
        () => editor.chain().focus().toggleCode().run(),
        editor.isActive("code"),
      )}
      <span className="mx-1 h-5 w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        }}
        className={`rounded px-2 py-1 text-sm font-medium ${
          editor.isActive("link")
            ? "bg-neutral-900 text-white"
            : "hover:bg-neutral-100"
        }`}
      >
        Link
      </button>
      <button
        type="button"
        onClick={onPickImage}
        disabled={uploading}
        className="rounded px-2 py-1 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Image"}
      </button>
      <span className="mx-1 h-5 w-px bg-neutral-200" />
      {btn("↶", () => editor.chain().focus().undo().run())}
      {btn("↷", () => editor.chain().focus().redo().run())}
    </div>
  );
}
