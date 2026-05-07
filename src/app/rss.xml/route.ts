import { getPublishedPosts } from "~/lib/content";

const BASE = process.env.SITE_URL ?? "https://goodmorningshelly.com";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const posts = getPublishedPosts().slice(0, 50);
  const items = posts
    .map((p) => {
      const url = `${BASE}/${p.slug}/`;
      const pubDate = p.date ? new Date(p.date).toUTCString() : "";
      return `<item>
  <title>${escapeXml(p.title)}</title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${pubDate}</pubDate>
  ${p.excerpt ? `<description>${escapeXml(p.excerpt)}</description>` : ""}
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Good Morning Shelly</title>
<link>${BASE}/</link>
<description>Personal blog</description>
<language>en-us</language>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
