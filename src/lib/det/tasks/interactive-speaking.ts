// INTERACTIVE SPEAKING — a fixed spoken interview, and the one type that uses
// BOTH kernels at once.
//
//   STAGED    (src/lib/det/staged.ts) turn n+1 is released only when turn n has
//             been answered.
//   SPEAKING  (src/lib/det/speaking.ts) each answer is a recording: paid-gated,
//             capped, transcribed once and metered.
//
// WHY PROGRESSIVE HERE. Every question is delivered as AUDIO and its text is
// server-only, so the interview only works if the taker meets the questions one
// at a time. Releasing all four clips up front would let someone listen ahead,
// plan four answers, and record them in order — which is a different task, and
// nothing in the resulting recordings would show it had happened. It is the same
// argument as Interactive Listening's turns, one skill over.
//
// COST IS BOUNDED BY THE CONTENT, NOT BY A LIMIT. The turns are pre-authored, so
// no question is generated at runtime. One interview is ONE attempt against
// SPEAKING_DAILY_CAP and costs four transcriptions plus ONE holistic rating —
// rating each turn separately would quadruple the rater spend for a worse read,
// because what this type measures is how someone sustains an exchange.
//
// SERVER-ONLY: every `turns[].question`, and `rubric.reference`. The first is not
// an answer key — it is the listening half of each turn, exactly like Listen Then
// Speak's question.
//
// DELIBERATELY FREE OF AI IMPORTS: client-payload.ts imports this, and the gates
// run client-payload.ts with no database and no network.

import { z } from "zod";
import {
  readStageProgress,
  readStoredAnswers,
  type StageAdvance,
  type StageProgress,
} from "@/lib/det/staged";

// ---------------------------------------------------------------- schema ----

export const interactiveSpeakingPayloadSchema = z.object({
  topic: z.string().min(1),
  register: z.string().min(1),
  turns: z
    .array(
      z.object({
        /** SERVER-ONLY. Spoken to the taker; never printed. */
        question: z.string().min(1),
        maxSeconds: z.number().int().positive(),
      }),
    )
    .min(2),
  rubric: z.object({
    traits: z.array(z.string().min(1)).min(1),
    reference: z.string().min(1),
  }),
});

export type ISPayload = z.infer<typeof interactiveSpeakingPayloadSchema>;

/** Answers are keyed "t0".."tN" in the shared StoredAnswers.text bag. */
export function isTurnKey(index: number): string {
  return `t${index}`;
}

/** DetItemAudio.seg for a turn's question clip: the turn index itself. One clip
 *  per turn, numbered from 0, so the mapping needs no lookup table. */
export function isTurnSeg(index: number): number {
  return index;
}

// ------------------------------------------------------------- progress ----

/** stage "turn" while the interview runs, "done" once every turn is answered.
 *  `turn` is the index currently released. */
export const IS_PROGRESS_START: StageProgress = { stage: "turn", turn: 0 };

export function readISProgress(stored: unknown): StageProgress {
  const p = readStageProgress(stored, IS_PROGRESS_START);
  return p.stage === "turn" || p.stage === "done" ? p : IS_PROGRESS_START;
}

// ---------------------------------------------------------- projections ----

export type ISTurnView = {
  index: number;
  total: number;
  /** null until the clip has been rendered. NEVER accompanied by text. */
  audioUrl: string | null;
  maxSeconds: number;
};

export type ISView = {
  stage: "turn" | "done";
  topic: string;
  register: string;
  /** How many turns are already answered — progress, not content. */
  answered: number;
  /** The ONE turn the taker may act on now. null once the interview is over. */
  current: ISTurnView | null;
  transcriptNote: string;
};

/**
 * The view for the taker's current position.
 *
 * A WHITELIST literal, and note what has no field to live in: the question text.
 * `current` carries an audio URL and a duration. There is no key on this shape
 * that could carry the question, and none that could carry the rubric.
 */
export function projectISView(
  raw: unknown,
  note: string,
  input: { stored?: unknown; audio?: Record<number, string> } = {},
): ISView {
  const parsed = interactiveSpeakingPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    // Fail CLOSED.
    throw new Error(
      `INTERACTIVE_SPEAKING payload does not parse — refusing to project it. ` +
        `${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const p = parsed.data;
  const audio = input.audio ?? {};
  const progress = readISProgress(input.stored);
  const { text } = readStoredAnswers(input.stored);
  const answered = p.turns.filter((_, i) => (text[isTurnKey(i)] ?? "").length > 0).length;

  const done = progress.stage === "done" || progress.turn >= p.turns.length;
  const t = done ? null : p.turns[progress.turn];

  return {
    stage: done ? "done" : "turn",
    topic: p.topic,
    register: p.register,
    answered,
    current:
      t === null || t === undefined
        ? null
        : {
            index: progress.turn,
            total: p.turns.length,
            audioUrl: audio[isTurnSeg(progress.turn)] ?? null,
            maxSeconds: t.maxSeconds,
          },
    transcriptNote: note,
  };
}

// --------------------------------------------------------- state machine ----

/** The step body. Carries the turn index and the TRANSCRIPT the server produced
 *  for that turn — never audio, and never anything the client authored. */
export const isStepSchema = z.object({
  kind: z.literal("turn"),
  index: z.number().int().nonnegative(),
  transcript: z.string(),
});

export type ISStep = z.infer<typeof isStepSchema>;

/**
 * The only place a turn closes.
 *
 * Both rejections are refusals to re-open something already answered: a turn
 * other than the one released, and any turn at all once the interview is over.
 * That is what stops someone re-recording turn 1 after hearing turn 4.
 */
export function advanceIS(
  payload: ISPayload,
  progress: StageProgress,
  step: ISStep,
): StageAdvance {
  if (progress.stage === "done") {
    return { ok: false, error: "This interview is already finished." };
  }
  if (step.index !== progress.turn) {
    return {
      ok: false,
      error: `Question ${progress.turn + 1} is the current one; question ${step.index + 1} is not available.`,
    };
  }
  const last = step.index + 1 >= payload.turns.length;
  return {
    ok: true,
    progress: last ? { stage: "done", turn: payload.turns.length } : { stage: "turn", turn: step.index + 1 },
    patch: { text: { [isTurnKey(step.index)]: step.transcript } },
  };
}

/** The transcripts in turn order, for the holistic rater and the review screen. */
export function isTranscripts(
  payload: ISPayload,
  text: Record<string, string>,
): { question: string; transcript: string }[] {
  return payload.turns.map((t, i) => ({
    question: t.question,
    transcript: text[isTurnKey(i)] ?? "",
  }));
}
