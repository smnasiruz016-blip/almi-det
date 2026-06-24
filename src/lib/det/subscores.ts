// Maps per-skill practice estimates onto the four DET integrated subscores.
//
// DET subscores each combine two skills (verified 2026-06-24):
//   Literacy      = Reading + Writing
//   Comprehension = Reading + Listening
//   Conversation  = Speaking + Listening
//   Production     = Speaking + Writing
//
// A single practice task exercises ONE skill, so it can only give provisional
// evidence about the two subscores that skill feeds. We surface that honestly:
// the other two subscores stay null ("not practised yet"), and a one-skill
// subscore is flagged provisional in the UI rather than presented as settled.

import type {
  DetSkill,
  Range,
  SubscoreEstimate,
  SubscoreKey,
} from "@/lib/det/types";
import { SUBSCORE_KEYS } from "@/lib/det/types";
import { rangeMidpoint, readinessBand, snapRange, type ReadinessBand } from "@/lib/det/scale";

/** The two subscores each skill contributes to. */
export const SKILL_FEEDS: Record<DetSkill, SubscoreKey[]> = {
  READING: ["literacy", "comprehension"],
  WRITING: ["literacy", "production"],
  LISTENING: ["comprehension", "conversation"],
  SPEAKING: ["conversation", "production"],
};

/** The two skills each subscore combines. */
export const SUBSCORE_SKILLS: Record<SubscoreKey, [DetSkill, DetSkill]> = {
  literacy: ["READING", "WRITING"],
  comprehension: ["READING", "LISTENING"],
  conversation: ["SPEAKING", "LISTENING"],
  production: ["SPEAKING", "WRITING"],
};

function emptyEstimate(): SubscoreEstimate {
  return {
    literacy: null,
    comprehension: null,
    conversation: null,
    production: null,
  };
}

/** Elementwise average of two ranges (used when both skills have evidence). */
function averageRanges(a: Range, b: Range): Range {
  return snapRange((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}

/**
 * Build a subscore estimate from one skill's practice range — the single-task
 * case (Phase 2). Only the two subscores that skill feeds get a (provisional)
 * range; the rest stay null.
 */
export function subscoreEstimateFromSkill(
  skill: DetSkill,
  skillRange: Range,
): SubscoreEstimate {
  const out = emptyEstimate();
  for (const key of SKILL_FEEDS[skill]) {
    out[key] = skillRange;
  }
  return out;
}

/**
 * Combine many skills' estimates into the four subscores. When both of a
 * subscore's skills have a range we average them; when only one does we carry
 * it through (provisional); when neither, null. This is the cumulative-progress
 * path used once more than one skill has been practised.
 */
export function combineSubscores(
  bySkill: Partial<Record<DetSkill, Range>>,
): SubscoreEstimate {
  const out = emptyEstimate();
  for (const key of SUBSCORE_KEYS) {
    const [sa, sb] = SUBSCORE_SKILLS[key];
    const ra = bySkill[sa];
    const rb = bySkill[sb];
    if (ra && rb) out[key] = averageRanges(ra, rb);
    else if (ra) out[key] = ra;
    else if (rb) out[key] = rb;
    else out[key] = null;
  }
  return out;
}

/** Which subscores have only one of their two skills so far (UI flags these). */
export function provisionalSubscores(
  bySkill: Partial<Record<DetSkill, Range>>,
): Set<SubscoreKey> {
  const provisional = new Set<SubscoreKey>();
  for (const key of SUBSCORE_KEYS) {
    const [sa, sb] = SUBSCORE_SKILLS[key];
    const has = (bySkill[sa] ? 1 : 0) + (bySkill[sb] ? 1 : 0);
    if (has === 1) provisional.add(key);
  }
  return provisional;
}

/**
 * Overall READINESS BAND (a label, never a number) from the available subscore
 * estimates. Uses the mean of present subscore midpoints — null subscores are
 * ignored, and if nothing is present we return null.
 */
export function overallReadiness(estimate: SubscoreEstimate): ReadinessBand | null {
  const mids: number[] = [];
  for (const key of SUBSCORE_KEYS) {
    const r = estimate[key];
    if (r) mids.push(rangeMidpoint(r));
  }
  if (mids.length === 0) return null;
  const mean = mids.reduce((s, n) => s + n, 0) / mids.length;
  return readinessBand(mean);
}
