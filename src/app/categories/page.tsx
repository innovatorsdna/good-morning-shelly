import Link from "next/link";
import { getAllCategories } from "~/lib/content";

export const metadata = { title: "Categories — Good Morning Shelly" };

export default async function CategoriesIndex() {
  const cats = await getAllCategories();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
      <ul className="mt-8 space-y-2">
        {cats.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/category/${c.slug}/`}
              className="flex items-baseline justify-between text-neutral-800 hover:text-neutral-600"
            >
              <span>{c.name}</span>
              <span className="text-sm text-neutral-500">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
