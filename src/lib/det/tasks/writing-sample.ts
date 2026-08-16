// WRITING SAMPLE (Writing, AI) — one prompt, 30 seconds to read it, 5 minutes
// to write ~100-130+ words.
//
// NOT STAGED. There is one prompt and one submission, so this needs none of the
// staged machinery — the 30-second prep is a UI state, not a server-enforced
// lock, because there is nothing to withhold: the taker is meant to be reading
// the prompt during it.
//
// THE HONESTY NOTE IS PART OF THE PROJECTION, not the composer's copy. In the
// official DET this sample is sent to institutions UNSCORED. We rate it because
// this is a practice product and feedback is the whole point — but a practice
// tool that lets someone believe the real test scores this has misled them about
// the exam. Putting the sentence in the projected payload means it cannot be
// dropped by a redesign of the composer without the gate noticing.
//
// SERVER-ONLY: `rubric.reference` — what a strong answer does, in prose. That is
// the rater's target, the same class of field as the photo tasks' `imageAlt`.
//
// No AI imports here; the rater is writing-rater.ts, shared with Interactive
// Writing and imported only by the registry handler.

import { z } from "zod";

export const writingSamplePayloadSchema = z.object({
  category: z.string().min(1),
  topic: z.string().min(1),
  prompt: z.string().min(1),
  targetWords: z.string().min(1),
  rubric: z.object({
    traits: z.array(z.string().min(1)).min(1),
    reference: z.string().min(1),
  }),
});

export const writingSampleResponseSchema = z.object({
  text: z.string().default(""),
});

export type WSPayload = z.infer<typeof writingSamplePayloadSchema>;

/** 30 seconds to read the prompt with the textarea disabled, then 5 to write. */
export const WS_PREP_SECONDS = 30;
export const WS_WRITE_SECONDS = 300;

/**
 * The sentence the taker must see. Stated once, here, so the composer and
 * gate:writing-leak are reading the same string rather than two copies of an
 * honesty claim.
 */
export const WRITING_SAMPLE_NOTE =
  "In the official test this sample is sent to universities unscored; here we grade it so you can practise.";

/** Under this many words the response is treated as under-length by the rater.
 *  The projected `targetWords` is free text for the taker ("100–130+"); this is
 *  the number the scorer uses, kept separate so changing the display copy cannot
 *  silently change the marking. */
export const WS_MIN_WORDS = 100;

export type WSView = {
  category: string;
  topic: string;
  prompt: string;
  targetWords: string;
  prepSeconds: number;
  writeSeconds: number;
  practiceNote: string;
};

/**
 * A WHITELIST literal. `rubric` is not mentioned, so neither the reference nor
 * the trait anchors can reach the browser by accident.
 */
export function projectWSView(raw: unknown): WSView {
  const parsed = writingSamplePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    // Fail CLOSED.
    throw new Error(
      `WRITING_SAMPLE payload does not parse — refusing to project it. ` +
        `${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const p = parsed.data;
  return {
    category: p.category,
    topic: p.topic,
    prompt: p.prompt,
    targetWords: p.targetWords,
    prepSeconds: WS_PREP_SECONDS,
    writeSeconds: WS_WRITE_SECONDS,
    practiceNote: WRITING_SAMPLE_NOTE,
  };
}
