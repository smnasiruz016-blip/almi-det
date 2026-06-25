// University layer — sourced from Duolingo's own accepting-institutions list
// (englishtest.duolingo.com), 4,022 institutions across 116 countries. Every
// entry is a REAL Duolingo-confirmed DET-accepting institution, so the base
// page is indexable. AlmiStudy enrichment adds canonical subject slugs where
// the institution matched — those open the subject layer. No fabrication:
// we never invent a per-university score, only "accepts the DET" (confirmed)
// plus country-level guidance.

import rawUnis from "./universities-data.json";
import { DET_ORIGIN_SLUGS, getLocalizedOrigin } from "./origins";

export type DetUni = { slug: string; name: string; country: string; subjects: string[] };

const UNIS = rawUnis as DetUni[];
const byKey = new Map<string, DetUni>(UNIS.map((u) => [`${u.country}/${u.slug}`, u]));

export const DET_UNIS: DetUni[] = UNIS;

export function findDetUni(country: string, slug: string): DetUni | undefined {
  return byKey.get(`${country}/${slug}`);
}

/** Base university page is indexable when the institution is on Duolingo's list. */
export const isDetUniIndexable = (country: string, slug: string): boolean =>
  byKey.has(`${country}/${slug}`);

/** Subject layer is indexable only where AlmiStudy enrichment confirms the
 *  institution teaches that canonical subject. */
export function isDetUniSubjectIndexable(country: string, slug: string, subject: string): boolean {
  const u = byKey.get(`${country}/${slug}`);
  return Boolean(u && u.subjects.includes(subject));
}

// Localized origins (real substance) — the origin leaves index only against these.
export const LOCALIZED_ORIGIN_SLUGS: string[] = DET_ORIGIN_SLUGS.filter((s) => Boolean(getLocalizedOrigin(s)));

/** Flat list of (uni, subject) pairs that are indexable — for the sitemap. */
export const UNI_SUBJECT_PAIRS: { country: string; slug: string; subject: string }[] = UNIS.flatMap((u) =>
  u.subjects.map((subject) => ({ country: u.country, slug: u.slug, subject })),
);
