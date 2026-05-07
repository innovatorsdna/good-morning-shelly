import { notFound } from "next/navigation";
import { PostCard } from "~/components/post-card";
import {
  getAllCategories,
  getCategoryDisplayName,
  getPostsByCategory,
} from "~/lib/content";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const cats = await getAllCategories();
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: RouteParams) {
  const { slug } = await params;
  return { title: `${getCategoryDisplayName(slug)} — Good Morning Shelly` };
}

export default async function CategoryPage({ params }: RouteParams) {
  const { slug } = await params;
  const posts = await getPostsByCategory(slug);
  if (posts.length === 0) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 border-b border-neutral-200 pb-4">
        <p className="text-sm uppercase tracking-wide text-neutral-500">
          Category
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
          {getCategoryDisplayName(slug)}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </header>
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </main>
  );
}
