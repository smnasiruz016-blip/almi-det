import type { MetadataRoute } from "next";
import { DET_DESTINATION_SLUGS, isDetDestinationIndexable } from "./destinations";
import { DET_ORIGIN_SLUGS, isDetOriginIndexable, getLocalizedOrigin } from "./origins";
import { DET_UNIS, UNI_SUBJECT_PAIRS, LOCALIZED_ORIGIN_SLUGS } from "./universities";

export const SITE_URL = "https://almidet.almiworld.com";
export const CHUNK_SIZE = 45_000;

// MEMORY-SAFE: the university origin leaves (~1M+) are NEVER materialised as one
// array. Only BASE (~8k) is built and cached; each leaf is computed index-
// mathematically (uniIdx = L / nOrigins, originIdx = L % nOrigins), so a chunk
// request only ever builds <= CHUNK_SIZE URLs.

const L = LOCALIZED_ORIGIN_SLUGS.length; // localized origins (real substance)

let _base: MetadataRoute.Sitemap | null = null;
function baseUrls(): MetadataRoute.Sitemap {
  if (_base) return _base;
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
  ];
  // Matrix B — destinations (verified)
  for (const d of DET_DESTINATION_SLUGS) {
    if (isDetDestinationIndexable(d)) out.push({ url: `${SITE_URL}/requirements/${d}`, changeFrequency: "monthly", priority: 0.8 });
  }
  // Matrix A — origins (researched)
  for (const o of DET_ORIGIN_SLUGS) {
    if (isDetOriginIndexable(o)) out.push({ url: `${SITE_URL}/prepare/from-${o}`, changeFrequency: "monthly", priority: 0.6 });
  }
  // Matrix C — corridors (verified dest × localized origin)
  for (const d of DET_DESTINATION_SLUGS) {
    if (!isDetDestinationIndexable(d)) continue;
    for (const o of DET_ORIGIN_SLUGS) {
      if (getLocalizedOrigin(o)) out.push({ url: `${SITE_URL}/requirements/${d}/from-${o}`, changeFrequency: "monthly", priority: 0.5 });
    }
  }
  // University detail (Duolingo-confirmed) + uni × subject (AlmiStudy-enriched)
  for (const u of DET_UNIS) out.push({ url: `${SITE_URL}/requirements/${u.country}/${u.slug}`, changeFrequency: "monthly", priority: 0.5 });
  for (const p of UNI_SUBJECT_PAIRS) out.push({ url: `${SITE_URL}/requirements/${p.country}/${p.slug}/${p.subject}`, changeFrequency: "monthly", priority: 0.4 });
  _base = out;
  return out;
}

const baseLen = () => baseUrls().length;
const leafACount = () => DET_UNIS.length * L; // uni × localized-origin
const leafBCount = () => UNI_SUBJECT_PAIRS.length * L; // uni × subject × localized-origin

export function totalUrlCount(): number {
  return baseLen() + leafACount() + leafBCount();
}

export function numSitemapChunks(): number {
  return Math.max(1, Math.ceil(totalUrlCount() / CHUNK_SIZE));
}

/** Build only the URLs for one chunk — index-math, never the full array. */
export function urlsForChunk(chunkIndex: number): MetadataRoute.Sitemap {
  const base = baseUrls();
  const bLen = base.length;
  const a = leafACount();
  const total = totalUrlCount();
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, total);
  const out: MetadataRoute.Sitemap = [];
  for (let i = start; i < end; i++) {
    if (i < bLen) {
      out.push(base[i]);
    } else if (i < bLen + a) {
      const j = i - bLen;
      const u = DET_UNIS[Math.floor(j / L)];
      const o = LOCALIZED_ORIGIN_SLUGS[j % L];
      out.push({ url: `${SITE_URL}/requirements/${u.country}/${u.slug}/from-${o}`, changeFrequency: "monthly", priority: 0.35 });
    } else {
      const j = i - bLen - a;
      const p = UNI_SUBJECT_PAIRS[Math.floor(j / L)];
      const o = LOCALIZED_ORIGIN_SLUGS[j % L];
      out.push({ url: `${SITE_URL}/requirements/${p.country}/${p.slug}/${p.subject}/from-${o}`, changeFrequency: "monthly", priority: 0.35 });
    }
  }
  return out;
}
