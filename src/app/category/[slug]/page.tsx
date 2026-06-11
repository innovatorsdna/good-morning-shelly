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
    <main className="px-6 pt-8">
      <header className="mb-10 border-b border-gms-line pb-5 text-center">
        <p className="m-0 mb-2 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
          Category
        </p>
        <h1 className="m-0 font-serif text-[32px] leading-[1.15] font-semibold text-gms-ink">
          {getCategoryDisplayName(slug)}
        </h1>
        <p className="m-0 mt-2 text-[12px] font-light tracking-[0.04em] text-gms-muted">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-7">
        {posts.map((p, i) => (
          <PostCard key={p.slug} post={p} index={i} />
        ))}
      </div>
    </main>
  );
}
