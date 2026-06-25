import type { MetadataRoute } from "next";
import { DET_DESTINATION_SLUGS, isDetDestinationIndexable } from "./destinations";
import { DET_ORIGIN_SLUGS, isDetOriginIndexable, getLocalizedOrigin } from "./origins";

export const SITE_URL = "https://almidet.almiworld.com";

// 45k URLs/chunk — under Google's 50k cap, with headroom as the layer scales.
// Chunked via the Next 16 generateSitemaps async-id pattern.
export const CHUNK_SIZE = 45_000;

// Gate-driven URL list (real-data-or-noindex): every URL is checked against the
// SAME indexability gate its page uses, so a noindex/thin page never leaks in.
// The university layer (Matrix D/E) is gate-closed → never sitemapped yet.
export function buildAllUrls(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
  ];

  // Matrix B — destinations (verified only)
  for (const d of DET_DESTINATION_SLUGS) {
    if (!isDetDestinationIndexable(d)) continue;
    out.push({ url: `${SITE_URL}/requirements/${d}`, lastModified: now, changeFrequency: "monthly", priority: 0.8 });
  }

  // Matrix A — origins (researched only)
  for (const o of DET_ORIGIN_SLUGS) {
    if (!isDetOriginIndexable(o)) continue;
    out.push({ url: `${SITE_URL}/prepare/from-${o}`, lastModified: now, changeFrequency: "monthly", priority: 0.6 });
  }

  // Matrix C — corridors (destination verified AND origin localized)
  for (const d of DET_DESTINATION_SLUGS) {
    if (!isDetDestinationIndexable(d)) continue;
    for (const o of DET_ORIGIN_SLUGS) {
      if (!getLocalizedOrigin(o)) continue;
      out.push({ url: `${SITE_URL}/requirements/${d}/from-${o}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
    }
  }

  return out;
}

/** Number of /sitemap/N.xml chunks the URL list splits into. */
export function numSitemapChunks(): number {
  return Math.max(1, Math.ceil(buildAllUrls().length / CHUNK_SIZE));
}
