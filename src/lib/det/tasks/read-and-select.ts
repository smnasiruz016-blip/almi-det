// READ AND SELECT (Reading, deterministic).
//
// The test-taker is shown a set of letter strings and marks the ones that are
// real English words. We mark each decision objectively: a word is scored
// correct when the user's "is it real?" judgement matches the answer key.
// Honest practice points = correct decisions / total. No AI, no DET number.
//
// All word lists are original to AlmiDET (we never copy Duolingo items).

import { z } from "zod";
import type {
  ReadAndSelectPayload,
  ReadAndSelectResponse,
} from "@/lib/det/types";

export const readAndSelectPayloadSchema = z.object({
  words: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        real: z.boolean(),
      }),
    )
    .min(1),
});

export const readAndSelectResponseSchema = z.object({
  selected: z.array(z.string()),
});

export type ReadAndSelectDetail = {
  words: { id: string; text: string; real: boolean; picked: boolean; correct: boolean }[];
};

export type DeterministicScore = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  detail: ReadAndSelectDetail;
};

export function scoreReadAndSelect(
  payload: ReadAndSelectPayload,
  response: ReadAndSelectResponse,
): DeterministicScore {
  const picked = new Set(response.selected);
  const words = payload.words.map((w) => {
    const isPicked = picked.has(w.id);
    // Correct when the user's "real?" judgement matches the key.
    const correct = isPicked === w.real;
    return { id: w.id, text: w.text, real: w.real, picked: isPicked, correct };
  });
  const pointsEarned = words.filter((w) => w.correct).length;
  const pointsMax = words.length;
  const fraction = pointsMax === 0 ? 0 : pointsEarned / pointsMax;
  return { pointsEarned, pointsMax, fraction, detail: { words } };
}
