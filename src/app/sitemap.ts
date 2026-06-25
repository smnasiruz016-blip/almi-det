import type { MetadataRoute } from "next";
import { urlsForChunk, numSitemapChunks } from "@/lib/det/seo/sitemap-urls";

// Next 16 emits the chunk routes at /sitemap/0.xml … /sitemap/N.xml. The sitemap
// INDEX is served separately at /sitemap-index.xml — submit that to GSC. The
// university origin leaves (~1M+) are computed index-mathematically per chunk
// (see sitemap-urls.ts), never materialised as one array.
export async function generateSitemaps() {
  return Array.from({ length: numSitemapChunks() }, (_, i) => ({ id: i }));
}

// CRITICAL (Next 16): `id` arrives as Promise<string>, not a number. Await +
// Number-coerce, or every chunk slices on NaN.
export default async function sitemap(
  { id }: { id: Promise<string> },
): Promise<MetadataRoute.Sitemap> {
  const idNum = Number(await id);
  return urlsForChunk(Number.isNaN(idNum) ? 0 : idNum);
}
