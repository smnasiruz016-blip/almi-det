import type { MetadataRoute } from "next";
import { buildAllUrls, numSitemapChunks, CHUNK_SIZE } from "@/lib/det/seo/sitemap-urls";

// Next 16 emits the chunk routes at /sitemap/0.xml … /sitemap/N.xml. The sitemap
// INDEX is served separately at /sitemap-index.xml (route handler) — submit that
// to GSC.
export async function generateSitemaps() {
  return Array.from({ length: numSitemapChunks() }, (_, i) => ({ id: i }));
}

// CRITICAL (Next 16): `id` arrives as Promise<string>, not a number. Must await +
// Number-coerce, or every chunk slices on NaN and serves an empty <urlset>.
export default async function sitemap(
  { id }: { id: Promise<string> },
): Promise<MetadataRoute.Sitemap> {
  const idNum = Number(await id);
  const start = (Number.isNaN(idNum) ? 0 : idNum) * CHUNK_SIZE;
  return buildAllUrls().slice(start, start + CHUNK_SIZE);
}
