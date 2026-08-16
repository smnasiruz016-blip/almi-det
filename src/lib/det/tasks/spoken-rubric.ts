// The three rubric-based speaking types — schemas, projections and timings.
//
// One module because they are one shape with one field's difference:
//
//   READ_THEN_SPEAK    prompt SHOWN, 90 seconds.
//   LISTEN_THEN_SPEAK  the question is AUDIO ONLY, 90 seconds.
//   SPEAKING_SAMPLE    prompt SHOWN, 3 minutes, unscored in the real DET.
//
// LISTEN_THEN_SPEAK IS THE ONE THAT WITHHOLDS. Its `question` is the listening
// half of the task: the taker has to understand it by ear before they can answer
// it. Printing the text alongside the audio would turn a listening-and-speaking
// item into a reading-and-speaking one, and nothing about the recording would
// reveal that it had happened. So the projection emits an audio URL and no text,
// and gate:speaking-leak proves it stays that way.
//
// ALL THREE WITHHOLD `rubric.reference` — the rater's target in prose, the same
// class of field as the writing types' reference and the photo tasks' imageAlt.
//
// DELIBERATELY FREE OF AI IMPORTS: client-payload.ts imports this for the
// projections, and the content gates execute client-payload.ts with no database
// and no network. The rater lives in speaking-rater.ts.

import { z } from "zod";

const rubricSchema = z.object({
  traits: z.array(z.string().min(1)).min(1),
  reference: z.string().min(1),
});

// ------------------------------------------------------------- schemas ------

export const readThenSpeakPayloadSchema = z.object({
  prompt: z.string().min(1),
  rubric: rubricSchema,
});

export const listenThenSpeakPayloadSchema = z.object({
  /** SERVER-ONLY. Spoken to the taker; never printed. */
  question: z.string().min(1),
  rubric: rubricSchema,
});

export const speakingSamplePayloadSchema = z.object({
  category: z.string().min(1),
  prompt: z.string().min(1),
  rubric: rubricSchema,
});

export const spokenResponseSchema = z.object({
  transcript: z.string().default(""),
});

// ------------------------------------------------------------- timings ------

export const RTS_SPEAK_SECONDS = 90;
export const LTS_SPEAK_SECONDS = 90;
export const SS_SPEAK_SECONDS = 180;

/** DetItemAudio.seg for a Listen Then Speak question. One clip per item, so 0 —
 *  the same slot Listen and Type uses for its single sentence. */
export const LTS_QUESTION_SEG = 0;
export const LTS_QUESTION_LABEL = "question";

/**
 * Shown wherever a Speaking Sample is rated. Same promise the Writing Sample
 * makes, for the same reason: in the official DET this sample goes to
 * institutions UNSCORED, and a practice tool that lets someone believe otherwise
 * has misled them about the exam. It travels in the PROJECTED payload so a
 * redesign of the composer cannot quietly drop it.
 */
export const SPEAKING_SAMPLE_NOTE =
  "In the official test this sample is sent to universities unscored; here we grade it so you can practise.";

// ---------------------------------------------------------- projections -----

export type RTSView = { prompt: string; speakSeconds: number; transcriptNote: string };
export type LTSView = {
  /** null until the question clip has been rendered. Never accompanied by text. */
  audioUrl: string | null;
  speakSeconds: number;
  transcriptNote: string;
};
export type SSView = {
  category: string;
  prompt: string;
  speakSeconds: number;
  transcriptNote: string;
  practiceNote: string;
};

function fail(taskType: string, err: z.ZodError): never {
  throw new Error(
    `${taskType} payload does not parse — refusing to project it. ` +
      `${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
  );
}

export function projectRTSView(raw: unknown, note: string): RTSView {
  const p = readThenSpeakPayloadSchema.safeParse(raw);
  if (!p.success) fail("READ_THEN_SPEAK", p.error);
  return { prompt: p.data.prompt, speakSeconds: RTS_SPEAK_SECONDS, transcriptNote: note };
}

/**
 * AUDIO ONLY. Note what is not here: `question`. There is no field on this view
 * that could carry it, which is the point — a whitelist literal cannot leak a
 * key it never names.
 */
export function projectLTSView(
  raw: unknown,
  note: string,
  audio: Record<number, string> = {},
): LTSView {
  const p = listenThenSpeakPayloadSchema.safeParse(raw);
  if (!p.success) fail("LISTEN_THEN_SPEAK", p.error);
  return {
    audioUrl: audio[LTS_QUESTION_SEG] ?? null,
    speakSeconds: LTS_SPEAK_SECONDS,
    transcriptNote: note,
  };
}

export function projectSSView(raw: unknown, note: string): SSView {
  const p = speakingSamplePayloadSchema.safeParse(raw);
  if (!p.success) fail("SPEAKING_SAMPLE", p.error);
  return {
    category: p.data.category,
    prompt: p.data.prompt,
    speakSeconds: SS_SPEAK_SECONDS,
    transcriptNote: note,
    practiceNote: SPEAKING_SAMPLE_NOTE,
  };
}
