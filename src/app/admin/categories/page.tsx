import { CategoriesManager } from "~/app/admin/_components/categories-manager";
import { api } from "~/trpc/server";

export const metadata = { title: "Categories — Admin" };

export default async function CategoriesAdminPage() {
  const categories = await api.admin.categoriesWithCounts();
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
      </header>
      <CategoriesManager initial={categories} />
    </main>
  );
}
