import Link from "next/link";
import { getAllCategories } from "~/lib/content";

export const metadata = { title: "Categories — Good Morning Shelly" };

export default async function CategoriesIndex() {
  const cats = await getAllCategories();
  return (
    <main className="px-6 pt-8">
      <header className="mb-8 text-center">
        <p className="m-0 mb-2 text-[10px] font-bold tracking-[0.2em] text-gms-rose uppercase">
          Browse
        </p>
        <h1 className="m-0 font-serif text-[32px] font-semibold text-gms-ink">
          Categories
        </h1>
      </header>
      <ul className="m-0 list-none space-y-1 p-0">
        {cats.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/category/${c.slug}/`}
              className="flex items-baseline justify-between border-b border-gms-line py-3 text-gms-stone hover:text-gms-sage"
            >
              <span>{c.name}</span>
              <span className="text-[12px] font-light text-gms-muted">
                {c.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
