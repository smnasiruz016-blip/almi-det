// DET origin layer: the 10 researched base origins + ~181 localized origins,
// merged. The origin page is indexable only where we hold a real researched
// record (base or localized); everything else renders honest guidance noindex.

import { BASE_ORIGINS, findCountry, type Origin } from "./almi-data-local";
import { EXTRA_ORIGINS, type LocalizedOrigin } from "./origins-extra";

export type { Origin, LocalizedOrigin };

export const DET_ORIGINS: readonly Origin[] = [...BASE_ORIGINS, ...EXTRA_ORIGINS];

const _bySlug = new Map<string, Origin>(DET_ORIGINS.map((o) => [o.slug, o]));
const _locBySlug = new Map<string, LocalizedOrigin>(EXTRA_ORIGINS.map((o) => [o.slug, o]));

export const DET_ORIGIN_SLUGS: string[] = DET_ORIGINS.map((o) => o.slug);

export const findDetOrigin = (slug: string): Origin | undefined => _bySlug.get(slug);
export const getLocalizedOrigin = (slug: string): LocalizedOrigin | undefined => _locBySlug.get(slug);

/** Origin page is indexable when a researched origin record exists. */
export const isDetOriginIndexable = (slug: string): boolean => _bySlug.has(slug);

/** DET-specific localized search wording for an origin (per the build spec). */
export function detOriginQueries(slug: string): string[] {
  const name = findCountry(slug)?.name ?? slug.replace(/-/g, " ");
  const det = [`DET fee in ${name}`, `Duolingo accepted universities from ${name}`, `DET vs IELTS ${name}`];
  const loc = getLocalizedOrigin(slug);
  return loc ? [...loc.localizedQueries, ...det] : det;
}

/** A short, archetype-driven angle so each origin page's lead is its own. */
export function detOriginAngle(origin: Origin): { heading: string; point: string } {
  switch (origin.archetype) {
    case "pr-roi":
      return { heading: `Plan the spend from ${origin.name}`, point: "Weigh the test fee against the route that actually leads to long-term plans — not just the first offer." };
    case "healthcare":
      return { heading: `Registration-aware planning from ${origin.name}`, point: "Confirm the English evidence your professional registration needs, separate from university admission." };
    case "scholarship":
      return { heading: `Funding-first from ${origin.name}`, point: `Check whether each scholarship route accepts the DET before you sit it. Clusters to search: ${origin.scholarshipCluster.join(", ")}.` };
    case "work-sponsorship":
      return { heading: `Sponsorship-aware from ${origin.name}`, point: "Line up the admission English test with any later work-route English evidence so you do not pay twice." };
    default:
      return { heading: `Ranking-first from ${origin.name}`, point: "Match the DET score band to the universities you are actually targeting, not a generic minimum." };
  }
}
