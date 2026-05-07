import type { MetadataRoute } from "next";
import {
  getAllCategories,
  getAllItems,
} from "~/lib/content";

const BASE = process.env.SITE_URL ?? "https://goodmorningshelly.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const items = getAllItems().filter((it) => it.status === "publish");
  const cats = getAllCategories();

  return [
    { url: `${BASE}/`, changeFrequency: "weekly" },
    { url: `${BASE}/archive/`, changeFrequency: "weekly" },
    { url: `${BASE}/categories/`, changeFrequency: "weekly" },
    ...items.map((it) => ({
      url: `${BASE}/${it.slug}/`,
      lastModified: it.modified ? new Date(it.modified) : new Date(it.date),
    })),
    ...cats.map((c) => ({
      url: `${BASE}/category/${c.slug}/`,
      changeFrequency: "weekly" as const,
    })),
  ];
}
