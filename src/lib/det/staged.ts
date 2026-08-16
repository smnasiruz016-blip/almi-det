// STAGED TASKS — the shared kernel behind every task that is answered in locked
// steps rather than in one submission.
//
// Interactive Listening was the first: Part A's typed gaps must be final before
// the conversation is heard, or the reply options give the answers away.
// Interactive Writing is the second: Part 1 must be final before Part 2's prompt
// is known, or Part 1 gets written to suit the follow-up. Same shape, same three
// pieces, so they are here once rather than twice:
//
//   PROGRESS   lives on DetAttempt.response, because that is the row the taker's
//              own work already occupies. A separate table would be a second
//              thing to keep in step, and progress is meaningless without the
//              answers it accompanies.
//   ADVANCE    one function per task decides whether a step is allowed. Every
//              rejection it can return is a refusal to RE-OPEN something already
//              answered — that is what makes a stage lock a lock rather than a
//              greyed-out textarea.
//   PROJECT    the same per-task function the render seam calls, so the view the
//              route hands back after a step is byte-identical to the view a page
//              reload would produce. Two code paths here would drift.
//
// WHY THE UI LOCK IS NOT THE LOCK. The composer greys out a submitted part, and
// that stops an honest taker. It stops nobody with devtools. The lock is this
// file plus the driver's advance(): the server refuses the second submission and
// never releases the next prompt until the current one is recorded.
//
// Import-light on purpose — no Prisma, no AI client. The content gates execute
// projections with no database and no network.

import { z } from "zod";

/** Where a taker has got to. `turn` is only meaningful to tasks that loop
 *  within a stage (Interactive Listening); two-part tasks leave it at -1. */
export const stageProgressSchema = z.object({
  stage: z.string().min(1),
  turn: z.number().int(),
});

export type StageProgress = z.infer<typeof stageProgressSchema>;

/**
 * Everything a staged task may have recorded so far.
 *
 * One explicit bag rather than a free-form record: these are the four shapes an
 * answer takes across the bank, they are typed, and adding a fifth is one line.
 * A `Record<string, unknown>` would have been shorter and would have made every
 * consumer guess.
 *
 *   filled   blank id -> typed word            (Interactive Listening Part A)
 *   chosen   turn index -> DISPLAYED position  (Interactive Listening Part B)
 *   text     part key -> written response      (Interactive Writing)
 *   summary  free text                         (Interactive Listening Part C)
 */
export type StoredAnswers = {
  filled: Record<string, string>;
  chosen: Record<string, number>;
  text: Record<string, string>;
  summary: string;
};

export type StagePatch = Partial<StoredAnswers>;

export type StageAdvance =
  | { ok: true; progress: StageProgress; patch: StagePatch }
  | { ok: false; error: string };

/**
 * What a staged task type must provide. Registered in
 * src/lib/det/staged-drivers.ts, which is the only thing the advance route
 * knows about — the route never asks what kind of task it is holding.
 */
export type StageDriver = {
  /** Validates the step body. Rejection is a 400, not a silent coercion. */
  stepSchema: z.ZodType;
  /** Progress for an attempt that has not started. */
  start: StageProgress;
  /** True when the projection needs DetItemAudio rows. Checked before the query
   *  is spent, so text-only staged tasks do not pay for one. */
  needsAudio?: boolean;
  /**
   * Decide whether the step is allowed, and what it records. Pure — the route
   * owns the single database write.
   *
   * Takes the STORED RESPONSE rather than a pre-read progress, so each driver
   * validates progress with its own schema. Interactive Listening's stages are
   * an "A" | "B" | "C" union it narrows on; handing it a widened
   * `{ stage: string }` from the route would have thrown that away at the one
   * boundary where being strict is the point.
   */
  advance: (payload: unknown, stored: unknown, step: unknown) => StageAdvance;
  /** The view for the taker's current position. Same function the render seam
   *  calls, so the post-step view and a reload agree by construction. */
  project: (payload: unknown, ctx: { audio?: Record<number, string>; stored?: unknown }) => unknown;
};

/** Progress as the server recorded it, or the task's start state. Never throws:
 *  an unreadable response means the attempt has not begun, not that it is
 *  broken — and a throw here would take out the page rather than show step 1. */
export function readStageProgress(stored: unknown, start: StageProgress): StageProgress {
  if (!stored || typeof stored !== "object") return start;
  const parsed = stageProgressSchema.safeParse((stored as Record<string, unknown>).progress);
  return parsed.success ? parsed.data : start;
}

/** The taker's own recorded answers. Their data — safe to hand back, and handed
 *  back on purpose so a page reload does not lose a locked part. */
export function readStoredAnswers(stored: unknown): StoredAnswers {
  const s = (stored ?? {}) as Record<string, unknown>;
  const strings = (v: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries((v ?? {}) as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  };
  const numbers = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries((v ?? {}) as Record<string, unknown>)) {
      if (typeof val === "number" && Number.isInteger(val)) out[k] = val;
    }
    return out;
  };
  return {
    filled: strings(s.filled),
    chosen: numbers(s.chosen),
    text: strings(s.text),
    summary: typeof s.summary === "string" ? s.summary : "",
  };
}

/**
 * Merge a step's patch into what is already recorded, and stamp the new
 * progress. MERGE, never replace: the driver only ever patches the stage it just
 * allowed, so there is no path through here that revises an earlier answer.
 */
export function mergeStoredAnswers(
  stored: unknown,
  patch: StagePatch,
  progress: StageProgress,
): StoredAnswers & { progress: StageProgress } {
  const prior = readStoredAnswers(stored);
  return {
    filled: { ...prior.filled, ...(patch.filled ?? {}) },
    chosen: { ...prior.chosen, ...(patch.chosen ?? {}) },
    text: { ...prior.text, ...(patch.text ?? {}) },
    summary: patch.summary ?? prior.summary,
    progress,
  };
}
