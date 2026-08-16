// READ AND COMPLETE (Reading, deterministic — cloze).
//
// A short passage with letters removed from selected words. Each blank shows a
// visible prefix and one underscore per missing letter; the test-taker types the
// rest. Marking is per blank: the completed word is correct when the typed
// letters match the key, or any curated alternative.
//
// WHY alsoAccept EXISTS. A prefix plus a letter count usually fits several real
// English words — measured against a 275k word list, 16 of 20 ordinary words are
// ambiguous by form alone ("comp" + 4 fits 49 words). Context normally forces one
// reading, which is the skill this task tests, so we do NOT require form
// uniqueness. But where a second word genuinely fits both the letters AND the
// sentence, the author keys it in `alsoAccept` — marking a valid, context-fitting
// English word wrong would be unfair, and is the cloze twin of keying a real word
// as invented.
//
// All passages are original to AlmiDET — never copied from Duolingo.

import { z } from "zod";
import type { ReadAndCompletePayload, ReadAndCompleteResponse } from "@/lib/det/types";

const textToken = z.object({
  kind: z.literal("text"),
  text: z.string().min(1),
});

const blankToken = z.object({
  kind: z.literal("blank"),
  id: z.string().min(1),
  visiblePrefix: z.string().min(1),
  // Letters only: the taker types these on a plain keyboard, so punctuation or
  // whitespace inside the key would be unanswerable.
  missingLetters: z.string().regex(/^[A-Za-z]+$/),
  alsoAccept: z.array(z.string().regex(/^[A-Za-z]+$/)).optional(),
  suffix: z.string().optional(),
});

export const readAndCompletePayloadSchema = z.object({
  passage: z.array(z.discriminatedUnion("kind", [textToken, blankToken])).min(1),
});

export const readAndCompleteResponseSchema = z.object({
  filled: z.record(z.string(), z.string()),
});

/** Case- and whitespace-insensitive; never strips letters. */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export type ReadAndCompleteDetail = {
  blanks: {
    id: string;
    visiblePrefix: string;
    missingLetters: string;
    typed: string;
    correct: boolean;
  }[];
};

export function scoreReadAndComplete(
  payload: ReadAndCompletePayload,
  response: ReadAndCompleteResponse,
): {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  detail: ReadAndCompleteDetail;
} {
  const blanks = payload.passage.filter(
    (t): t is Extract<typeof t, { kind: "blank" }> => t.kind === "blank",
  );

  const scored = blanks.map((b) => {
    const typed = response.filled[b.id] ?? "";
    const accepted = new Set(
      [b.missingLetters, ...(b.alsoAccept ?? [])].map(normalize),
    );
    return {
      id: b.id,
      visiblePrefix: b.visiblePrefix,
      missingLetters: b.missingLetters,
      typed,
      correct: accepted.has(normalize(typed)),
    };
  });

  const pointsEarned = scored.filter((b) => b.correct).length;
  const pointsMax = scored.length;
  const fraction = pointsMax === 0 ? 0 : pointsEarned / pointsMax;
  return { pointsEarned, pointsMax, fraction, detail: { blanks: scored } };
}
