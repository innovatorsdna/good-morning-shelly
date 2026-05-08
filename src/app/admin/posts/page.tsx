import { PostsListView } from "~/app/admin/_components/posts-list-view";

interface SearchParams {
  status?: string;
  q?: string;
  page?: string;
}

export default async function PostsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <PostsListView type="post" searchParams={searchParams} title="Posts" />
  );
}
