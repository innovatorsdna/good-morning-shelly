interface Props {
  action: string;
  defaultQuery: string;
  defaultStatus: string;
}

export function PostsListFilters({ action, defaultQuery, defaultStatus }: Props) {
  return (
    <form
      action={action}
      method="get"
      className="mt-6 flex flex-wrap items-end gap-3"
    >
      <label className="flex-1 min-w-48 text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
          Search
        </span>
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="Title or slug…"
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
          Status
        </span>
        <select
          name="status"
          defaultValue={defaultStatus}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
        >
          <option value="">All</option>
          <option value="publish">Published</option>
          <option value="draft">Draft</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Apply
      </button>
    </form>
  );
}
