// The single source of truth for the Duolingo English Test scale in AlmiDET.
//
// DET reports scores from 10 to 160 in increments of 5 (verified 2026-06-24).
// AlmiDET turns practice performance into an HONEST per-skill estimate RANGE on
// this scale — deliberately wide, because a practice task is not a calibrated
// adaptive test. We never output a single precise number, and we never compute
// an "overall" (DET's overall is a proprietary adaptive estimate).
//
// The performance→range buckets below are a documented practice heuristic, not
// DET's scoring algorithm. They are intentionally conservative and overlapping.

import type { Range } from "@/lib/det/types";

export const DET_MIN = 10;
export const DET_MAX = 160;
export const DET_STEP = 5;

/** Clamp to [10,160] and snap to the nearest multiple of 5 — the DET grid. */
export function snapToScale(n: number): number {
  const clamped = Math.min(DET_MAX, Math.max(DET_MIN, n));
  return Math.round(clamped / DET_STEP) * DET_STEP;
}

export function snapRange(lo: number, hi: number): Range {
  const a = snapToScale(Math.min(lo, hi));
  const b = snapToScale(Math.max(lo, hi));
  return [a, b] as const;
}

// Coarse performance buckets. `fraction` is 0..1 — share of the available
// quality signal earned (objective: correct/total; productive: trait level
// normalised to 0..1). Each maps to a wide, humble range on the 10–160 scale.
const BUCKETS: { min: number; range: Range; label: string }[] = [
  { min: 0.0, range: [10, 55], label: "Foundational" },
  { min: 0.4, range: [40, 75], label: "Developing" },
  { min: 0.6, range: [60, 95], label: "Developing" },
  { min: 0.75, range: [80, 115], label: "Approaching readiness" },
  { min: 0.85, range: [100, 135], label: "Approaching readiness" },
  { min: 0.93, range: [120, 160], label: "Strong practice range" },
];

/** Map a 0..1 performance fraction to a practice-estimate range on 10–160. */
export function fractionToRange(fraction: number): Range {
  const f = Math.min(1, Math.max(0, fraction));
  let chosen = BUCKETS[0];
  for (const b of BUCKETS) {
    if (f >= b.min) chosen = b;
  }
  return snapRange(chosen.range[0], chosen.range[1]);
}

export type ReadinessBand =
  | "Foundational"
  | "Developing"
  | "Approaching readiness"
  | "Strong practice range";

/** Honest readiness label from a representative score (range midpoint). Coarse
 *  on purpose — a label, never a number we'd defend as a DET score. */
export function readinessBand(midpoint: number): ReadinessBand {
  if (midpoint >= 120) return "Strong practice range";
  if (midpoint >= 90) return "Approaching readiness";
  if (midpoint >= 55) return "Developing";
  return "Foundational";
}

export function rangeMidpoint(range: Range): number {
  return (range[0] + range[1]) / 2;
}

/** A loose CEFR hint for a 10–160 score. DET publishes CEFR alignment bands;
 *  these thresholds approximate them for orientation only. */
export function cefrHint(score: number): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" {
  if (score >= 140) return "C2";
  if (score >= 120) return "C1";
  if (score >= 95) return "B2";
  if (score >= 75) return "B1";
  if (score >= 55) return "A2";
  return "A1";
}

/** Format a range for display, e.g. "95–110". */
export function formatRange(range: Range): string {
  return `${range[0]}–${range[1]}`;
}
