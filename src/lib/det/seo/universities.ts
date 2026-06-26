// University layer — two real sources, merged:
//  1. Duolingo's accepting-institutions list (breadth): 4,022 confirmed
//     DET-accepting institutions (slug, name, country, canonical subjectSlugs).
//  2. AlmiStudy enrichment (depth, ACCURATE country): 577 DET-accepting
//     universities with city, course subjects, website, accreditation, a note.
// No fabrication: acceptance is Duolingo-confirmed; depth is AlmiStudy-sourced.

import rawDuo from "./universities-data.json";
import rawEnrich from "./study-enrichment.json";
import { DET_ORIGIN_SLUGS } from "./origins";

export type DetUni = { slug: string; name: string; country: string; subjects: string[] };
export type EnrichedUni = {
  country: string;
  slug: string;
  name: string;
  city: string | null;
  subjects: string[]; // readable display subjects (AlmiStudy)
  website: string | null;
  accreditation: string | null;
  note: string | null;
};

const DUO = rawDuo as DetUni[];
const ENRICH = rawEnrich as EnrichedUni[];

// Rich enrichment indexes (accurate AlmiStudy country).
const _enrichByKey = new Map<string, EnrichedUni>(ENRICH.map((u) => [`${u.country}/${u.slug}`, u]));
const _enrichByCountry = new Map<string, EnrichedUni[]>();
for (const u of ENRICH) {
  const arr = _enrichByCountry.get(u.country);
  if (arr) arr.push(u);
  else _enrichByCountry.set(u.country, [u]);
}

export function findEnrichedUni(country: string, slug: string): EnrichedUni | undefined {
  return _enrichByKey.get(`${country}/${slug}`);
}
/** DET-accepting universities in a country, with rich AlmiStudy data, for the
 *  destination page list. Accurate country (not Duolingo's program-country). */
export function detUnisInCountry(country: string, limit = 14): EnrichedUni[] {
  return (_enrichByCountry.get(country) ?? []).slice(0, limit);
}
export function countryEnrichedCount(country: string): number {
  return (_enrichByCountry.get(country) ?? []).length;
}

// Unified university set (gates + sitemap). Duolingo for breadth; enrichment-only
// universities added under their accurate country.
const byKey = new Map<string, DetUni>();
for (const u of DUO) byKey.set(`${u.country}/${u.slug}`, u);
for (const u of ENRICH) {
  const k = `${u.country}/${u.slug}`;
  if (!byKey.has(k)) byKey.set(k, { slug: u.slug, name: u.name, country: u.country, subjects: [] });
}

export const DET_UNIS: DetUni[] = [...byKey.values()];

export function findDetUni(country: string, slug: string): DetUni | undefined {
  return byKey.get(`${country}/${slug}`);
}
export const isDetUniIndexable = (country: string, slug: string): boolean => byKey.has(`${country}/${slug}`);

export function isDetUniSubjectIndexable(country: string, slug: string, subject: string): boolean {
  const u = byKey.get(`${country}/${slug}`);
  return Boolean(u && u.subjects.includes(subject));
}

// Leaf origins for the sitemap = all 191 researched origins.
export const LEAF_ORIGIN_SLUGS: string[] = DET_ORIGIN_SLUGS;

export const UNI_SUBJECT_PAIRS: { country: string; slug: string; subject: string }[] = DET_UNIS.flatMap((u) =>
  u.subjects.map((subject) => ({ country: u.country, slug: u.slug, subject })),
);
