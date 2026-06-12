"use client";

import { useMemo, useRef, useState } from "react";

import { authClient } from "~/server/better-auth/client";
import { api, type RouterOutputs } from "~/trpc/react";
import { TurnstileWidget } from "./turnstile-widget";

type CommentNode = RouterOutputs["comment"]["list"][number] & {
  replies: CommentNode[];
};

function buildTree(flat: RouterOutputs["comment"]["list"]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  for (const c of flat) byId.set(c.id, { ...c, replies: [] });
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId != null && byId.has(node.parentId)) {
      byId.get(node.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="bg-gms-panel text-gms-stone flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CommentView({
  node,
  postId,
  depth,
}: {
  node: CommentNode;
  postId: number;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="mt-5">
      <div className="flex gap-3">
        <Avatar name={node.authorName} image={node.authorImage} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-gms-ink text-sm font-semibold">
              {node.authorName}
            </span>
            <time className="text-gms-muted text-xs">
              {new Date(node.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </div>
          <p className="text-gms-stone mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">
            {node.body}
          </p>
          {depth < 3 && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="text-gms-sage mt-1 text-xs font-medium hover:underline"
            >
              {replying ? "Cancel" : "Reply"}
            </button>
          )}
          {replying && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={node.id}
                onDone={() => setReplying(false)}
                compact
              />
            </div>
          )}
          {node.replies.length > 0 && (
            <ul className="border-gms-line border-l pl-4">
              {node.replies.map((child) => (
                <CommentView
                  key={child.id}
                  node={child}
                  postId={postId}
                  depth={depth + 1}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function CommentForm({
  postId,
  parentId,
  onDone,
  compact = false,
}: {
  postId: number;
  parentId?: number;
  onDone?: () => void;
  compact?: boolean;
}) {
  const { data: session } = authClient.useSession();
  const utils = api.useUtils();
  const mountedAt = useRef(Date.now());

  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isLoggedIn = !!session?.user;

  const create = api.comment.create.useMutation({
    onSuccess: async (res) => {
      setBody("");
      setGuestName("");
      setGuestEmail("");
      setToken(null);
      if (res.status === "approved") {
        await utils.comment.list.invalidate({ postId });
        onDone?.();
      } else {
        setNotice(
          "Thanks! Your comment was flagged for review and will appear once approved.",
        );
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    create.mutate({
      postId,
      parentId,
      body,
      guestName: isLoggedIn ? undefined : guestName || undefined,
      guestEmail: isLoggedIn ? undefined : guestEmail || undefined,
      turnstileToken: token ?? undefined,
      website,
      elapsedMs: Date.now() - mountedAt.current,
    });
  };

  const signInWith = (provider: "google" | "facebook") =>
    authClient.signIn.social({
      provider,
      callbackURL: typeof window !== "undefined" ? window.location.href : "/",
    });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!compact && !isLoggedIn && (
        <div className="text-gms-muted flex flex-wrap items-center gap-2 text-sm">
          <span>Comment as a guest, or sign in:</span>
          <button
            type="button"
            onClick={() => signInWith("google")}
            className="border-gms-line text-gms-stone hover:bg-gms-panel rounded-full border px-3 py-1 font-medium"
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => signInWith("facebook")}
            className="border-gms-line text-gms-stone hover:bg-gms-panel rounded-full border px-3 py-1 font-medium"
          >
            Facebook
          </button>
        </div>
      )}

      {!isLoggedIn && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            placeholder="Name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="border-gms-line focus:border-gms-sage rounded-md border bg-white px-3 py-2 text-sm outline-none"
          />
          <input
            type="email"
            placeholder="Email (optional, not published)"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="border-gms-line focus:border-gms-sage rounded-md border bg-white px-3 py-2 text-sm outline-none"
          />
        </div>
      )}

      <textarea
        required
        rows={compact ? 2 : 3}
        placeholder={parentId ? "Write a reply…" : "Share your thoughts…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="border-gms-line focus:border-gms-sage rounded-md border bg-white px-3 py-2 text-sm leading-relaxed outline-none"
      />

      {/* Honeypot: hidden from real users; bots tend to fill every field. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {!isLoggedIn && <TurnstileWidget onToken={setToken} />}

      {create.error && (
        <p className="text-gms-rose text-sm">{create.error.message}</p>
      )}
      {notice && <p className="text-gms-sage text-sm">{notice}</p>}

      <div>
        <button
          type="submit"
          disabled={create.isPending}
          className="bg-gms-sage rounded-full px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {create.isPending
            ? "Posting…"
            : parentId
              ? "Post reply"
              : "Post comment"}
        </button>
      </div>
    </form>
  );
}

export function CommentsSection({ postId }: { postId: number }) {
  const { data, isLoading } = api.comment.list.useQuery({ postId });
  const tree = useMemo(() => buildTree(data ?? []), [data]);
  const total = data?.length ?? 0;

  return (
    <section className="border-gms-line mx-auto mt-16 max-w-2xl border-t pt-10">
      <h2 className="text-gms-ink font-serif text-2xl font-semibold">
        {total > 0 ? `${total} Comment${total === 1 ? "" : "s"}` : "Comments"}
      </h2>

      <div className="mt-6">
        <CommentForm postId={postId} />
      </div>

      {isLoading ? (
        <p className="text-gms-muted mt-8 text-sm">Loading comments…</p>
      ) : tree.length === 0 ? (
        <p className="text-gms-muted mt-8 text-sm">
          Be the first to share a thought.
        </p>
      ) : (
        <ul className="mt-8">
          {tree.map((node) => (
            <CommentView key={node.id} node={node} postId={postId} depth={0} />
          ))}
        </ul>
      )}
    </section>
  );
}
