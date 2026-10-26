import type { MetadataRoute } from "next";

export const SITE_URL = "https://almidet.almiworld.com";
export const CHUNK_SIZE = 45_000;

// Cost fix (Oct 2026, owner ruling 17 Oct): the programmatic /prepare/** and
// /requirements/** pages (about a million destination × university × subject ×
// origin URLs) were deleted. They now answer 410 Gone (src/proxy.ts), so no
// sitemap lists them. The sitemap keeps its chunked shape (/sitemap/N.xml plus
// /sitemap-index.xml) so the URL submitted to Google stays the same.

function allUrls(): MetadataRoute.Sitemap {
  const now = new Date();
  return [{ url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 }];
}

export function totalUrlCount(): number {
  return allUrls().length;
}

export function numSitemapChunks(): number {
  return Math.max(1, Math.ceil(totalUrlCount() / CHUNK_SIZE));
}

/** The URLs for one chunk. */
export function urlsForChunk(chunkIndex: number): MetadataRoute.Sitemap {
  const start = chunkIndex * CHUNK_SIZE;
  return allUrls().slice(start, start + CHUNK_SIZE);
}
