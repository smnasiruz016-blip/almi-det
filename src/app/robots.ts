import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // App-only for now; the SEO landing layer (and its sitemap) is a later phase.
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
