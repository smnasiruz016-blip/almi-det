// THE SPEAKING KERNEL — shared by every task type answered with a microphone.
//
// Speaking is the only skill where an attempt COSTS MONEY BEFORE IT IS GRADED.
// Reading and writing items are marked from data already in the database; a
// speaking item has to be uploaded and transcribed first, and the transcription
// is billed whether or not the answer turns out to be any good. That makes cost
// control part of the mechanism rather than something bolted on after, and it
// dictates the ORDER below.
//
//   1. PAID ACCESS   refuse before anything is spent.
//   2. DAILY CAP     refuse before anything is spent.
//   3. TRANSCRIBE    the only billed step, metered on every exit path.
//   4. GRADE         per task type.
//
// The two refusals come FIRST for one reason: a refusal that happens after the
// Whisper call has already been made costs exactly as much as an accepted
// attempt. gate:speaking-access proves the ordering behaviourally by handing the
// kernel a transcriber stub and asserting it is never reached on a refusal.
//
// EVERYTHING IS INJECTED. runSpeakingAttempt takes its transcriber, its attempt
// counter and its clock as arguments. That is what lets a content gate exercise
// the real ordering logic with no database, no network and — the point — NO LIVE
// WHISPER CALL. The route supplies the real implementations; nothing else does.

import type { DetTaskType } from "@prisma/client";

/**
 * How many speaking attempts one user may make per day, across ALL speaking
 * task types.
 *
 * ONE CONSTANT, ON PURPOSE. This is the only number bounding what a single
 * account can spend on transcription in a day, so it has exactly one home. At
 * whisper-1's $0.006/minute and a ~20-second Read Aloud recording, 40 attempts
 * is roughly $0.08 per user per day — the cap exists to stop a runaway loop or a
 * bored account, not to ration honest practice.
 */
export const SPEAKING_DAILY_CAP = 40;

export type SpeakingRunResult = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  detail?: unknown;
  feedback?: unknown;
  telemetry?: { aiModel: string; costCents: number; latencyMs: number };
};

/**
 * What a speaking task type must supply. Everything else — the microphone, the
 * upload, the paid gate, the cap, the transcription, the persistence — is the
 * kernel's. A new speaking type provides a grader and a ledger label.
 */
export type SpeakingTask = {
  taskType: DetTaskType;
  /**
   * AICostLedger `feature` for this type's transcription calls. DISTINCT per
   * type, and gate:speaking-metered enforces that: folding every speaking type
   * into one label would make a per-feature reconciliation read a number that is
   * not about the thing it names — the same defect already fixed once in the TTS
   * generator.
   */
  transcribeFeature: string;
  /** Seconds of recording this type allows, for the composer's timer. */
  recordSeconds: number;
  grade: (args: {
    transcript: string;
    payload: unknown;
    userId: string;
  }) => Promise<SpeakingRunResult>;
};

export type SpeakingDeps = {
  /** Counts the user's speaking attempts since local midnight, ALL types. */
  countAttemptsToday: (userId: string) => Promise<number>;
  /** MUST be a metered implementation. The route passes the one in
   *  src/lib/ai/openai.ts, which records a ledger row on success, on HTTP
   *  failure and on network failure. */
  transcribe: (args: {
    file: Blob;
    filename: string;
    durationSeconds: number;
    userId: string;
    feature: string;
  }) => Promise<string>;
};

export type SpeakingRefusal = {
  ok: false;
  status: number;
  error: string;
  upgradeUrl?: string;
  /** Which guard refused — read by gate:speaking-access. */
  reason: "UNPAID" | "DAILY_CAP" | "EMPTY_AUDIO";
};

export type SpeakingOutcome =
  | SpeakingRefusal
  | { ok: true; transcript: string; result: SpeakingRunResult };

export const SPEAKING_UNPAID_MESSAGE =
  "Speaking practice needs a subscription — every recording is transcribed, and that costs us money on every attempt.";

export function speakingCapMessage(cap: number): string {
  return (
    `You have used all ${cap} speaking attempts for today. This cap keeps transcription costs ` +
    `predictable; it resets tomorrow, and the other three skills are unaffected.`
  );
}

/**
 * Run one speaking attempt.
 *
 * Pure apart from the injected dependencies, so the whole ordering — including
 * "nothing is spent on a refusal" — is testable without touching OpenAI.
 */
/**
 * The two refusals and the audio check, in the order that makes them cost
 * control rather than merely policy. Extracted so a STAGED speaking task can
 * apply exactly the same guards to every turn it transcribes — a per-turn upload
 * that skipped them would be an unguarded billed call wearing an interview's
 * clothes.
 *
 * Returns the refusal, or null when the attempt may proceed.
 */
export async function checkSpeakingAllowed(args: {
  userId: string;
  isPaid: boolean;
  audio: { file: Blob; filename: string; durationSeconds: number } | null;
  deps: Pick<SpeakingDeps, "countAttemptsToday">;
  cap?: number;
}): Promise<SpeakingRefusal | null> {
  const { userId, isPaid, audio, deps } = args;
  const cap = args.cap ?? SPEAKING_DAILY_CAP;

  // ---- 1. PAID ACCESS, before anything is spent ----
  if (!isPaid) {
    return {
      ok: false,
      status: 402,
      error: SPEAKING_UNPAID_MESSAGE,
      upgradeUrl: "/pricing",
      reason: "UNPAID",
    };
  }

  // ---- 2. DAILY CAP, before anything is spent ----
  const used = await deps.countAttemptsToday(userId);
  if (used >= cap) {
    return { ok: false, status: 429, error: speakingCapMessage(cap), reason: "DAILY_CAP" };
  }

  // ---- audio sanity, still before anything is spent ----
  // A zero-length upload would be billed at the API's minimum and transcribe to
  // nothing, so it is refused rather than charged for.
  if (!audio || audio.file.size === 0) {
    return {
      ok: false,
      status: 400,
      error: "No audio was received. Check your microphone permission and record again.",
      reason: "EMPTY_AUDIO",
    };
  }

  return null;
}

/**
 * ONE TURN of a staged speaking task: the same guards, then transcription, and
 * no grading. The interview is rated once at the end from every transcript
 * together, so a mid-interview turn must be billed for its transcription and
 * nothing else.
 */
export async function transcribeSpeakingTurn(args: {
  userId: string;
  isPaid: boolean;
  task: SpeakingTask;
  audio: { file: Blob; filename: string; durationSeconds: number } | null;
  deps: SpeakingDeps;
  cap?: number;
}): Promise<SpeakingRefusal | { ok: true; transcript: string }> {
  const refusal = await checkSpeakingAllowed(args);
  if (refusal) return refusal;

  const transcript = await args.deps.transcribe({
    file: args.audio!.file,
    filename: args.audio!.filename,
    durationSeconds: args.audio!.durationSeconds,
    userId: args.userId,
    feature: args.task.transcribeFeature,
  });
  return { ok: true, transcript };
}

export async function runSpeakingAttempt(args: {
  userId: string;
  isPaid: boolean;
  task: SpeakingTask;
  payload: unknown;
  audio: { file: Blob; filename: string; durationSeconds: number } | null;
  deps: SpeakingDeps;
  cap?: number;
}): Promise<SpeakingOutcome> {
  const { userId, task, payload, audio, deps } = args;

  const refusal = await checkSpeakingAllowed(args);
  if (refusal) return refusal;

  // ---- 3. TRANSCRIBE — the billed step ----
  const transcript = await deps.transcribe({
    file: audio!.file,
    filename: audio!.filename,
    durationSeconds: audio!.durationSeconds,
    userId,
    feature: task.transcribeFeature,
  });

  // ---- 4. GRADE ----
  const result = await task.grade({ transcript, payload, userId });
  return { ok: true, transcript, result };
}

/** Local midnight for the cap window. Exported so the route and the gate agree
 *  on what "today" means rather than each rolling their own. */
export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
