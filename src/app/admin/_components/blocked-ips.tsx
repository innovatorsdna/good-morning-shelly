"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function BlockedIps() {
  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  const list = api.comment.listBlockedIps.useQuery();

  const block = api.comment.blockIp.useMutation({
    onSuccess: async () => {
      setIp("");
      setNote("");
      await utils.comment.listBlockedIps.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const unblock = api.comment.unblockIp.useMutation({
    onSuccess: async () => {
      await utils.comment.listBlockedIps.invalidate();
    },
  });

  const rows = list.data ?? [];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = ip.trim();
    if (!value) {
      setError("Enter an IP address to block.");
      return;
    }
    block.mutate({ ip: value, note: note.trim() || undefined });
  };

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs tracking-wide text-neutral-500 uppercase">
            IP address
          </span>
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            type="text"
            placeholder="203.0.113.4"
            className="w-56 rounded-md border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-neutral-400 focus:outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs tracking-wide text-neutral-500 uppercase">
            Note (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            type="text"
            placeholder="why this IP is blocked"
            className="w-64 rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={block.isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Block IP
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-3 py-2">Note / IP</th>
              <th className="px-3 py-2">Hash</th>
              <th className="px-3 py-2">Blocked</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!list.isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  No blocked IPs.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.ipHash}
                className="border-b border-neutral-100 align-middle last:border-0"
              >
                <td className="px-3 py-2 font-medium">
                  {row.note ?? <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                  {row.ipHash.slice(0, 12)}…
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => unblock.mutate({ ipHash: row.ipHash })}
                      disabled={unblock.isPending}
                      className="text-xs text-neutral-700 underline underline-offset-4 hover:text-neutral-900 disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
