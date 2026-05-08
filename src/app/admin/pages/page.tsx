import { PostsListView } from "~/app/admin/_components/posts-list-view";

interface SearchParams {
  status?: string;
  q?: string;
  page?: string;
}

export default async function PagesListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <PostsListView type="page" searchParams={searchParams} title="Pages" />
  );
}
