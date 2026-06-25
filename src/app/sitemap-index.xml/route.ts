import { SITE_URL, numSitemapChunks } from "@/lib/det/seo/sitemap-urls";

// Manual sitemap INDEX. Next 16's generateSitemaps emits the chunk routes
// (/sitemap/0.xml …) but does NOT auto-emit an index at /sitemap.xml in this
// version. This handler lists every chunk so a single GSC submission of
// /sitemap-index.xml discovers them all.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const now = new Date().toISOString();
  const n = numSitemapChunks();
  const entries = Array.from(
    { length: n },
    (_, i) => `  <sitemap>\n    <loc>${SITE_URL}/sitemap/${i}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
