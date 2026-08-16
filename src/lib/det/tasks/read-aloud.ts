// READ ALOUD (Speaking, deterministic).
//
// The taker reads a sentence aloud; the recording is transcribed and scored
// against that same sentence, word by word.
//
// THERE IS NO HIDDEN KEY. The target IS the task — it is on screen, because
// reading it is what is being tested. That makes this the one task type in the
// bank with nothing to withhold, and it is worth saying out loud: the projection
// emits the sentence deliberately, not by omission. Any future speaking type
// with a rubric WILL have a server-only reference, and gate:speaking-leak is
// stubbed and waiting for it.
//
// IT IS ALSO THE CHEAPEST SPEAKING TYPE. Grading is arithmetic on two strings,
// so an attempt costs exactly one Whisper call and no rater. That is why it is
// the first speaking type built: it exercises the whole microphone -> upload ->
// transcribe -> score -> persist path at the lowest possible spend.
//
// WHAT IS AND IS NOT MEASURED. This scores WORDS RECOGNISED, not pronunciation
// quality, and the score is only ever as good as Whisper's transcript. We do not
// claim to rate an accent, and the review screen says what was heard rather than
// implying a pronunciation judgement we cannot make.

import { z } from "zod";

export const readAloudPayloadSchema = z.object({
  /** The sentence to read. Shown to the taker — this is the stimulus. */
  text: z.string().min(1),
});

export const readAloudResponseSchema = z.object({
  transcript: z.string().default(""),
});

export type ReadAloudPayload = z.infer<typeof readAloudPayloadSchema>;

/** Lowercase, strip everything that is not a letter, digit or apostrophe, and
 *  split. Punctuation is not spoken, so it cannot be scored. */
export function normalizeSpoken(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Longest common subsequence — rewards the right words IN ORDER while
 *  tolerating an inserted filler or a dropped article, which is what a real
 *  reading of a sentence sounds like through a transcriber. */
function lcs(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1).fill(0);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[n];
}

export type ReadAloudDetail = {
  target: string;
  transcript: string;
  matched: number;
  total: number;
  /** Words in the target the transcript did not carry, in order. */
  missed: string[];
  /** Words heard that are not in the target — usually transcription noise. */
  extra: string[];
};

/**
 * Score a transcript against the known target.
 *
 * ACCURACY, NOT WER. Word Error Rate counts substitutions, insertions and
 * deletions and can exceed 1.0, which becomes a negative "score" the moment
 * anyone divides. In-order matched-words / target-words is bounded in [0,1],
 * means the same thing to a taker ("you got 9 of 11 words"), and degrades
 * sensibly when the transcriber mishears rather than collapsing.
 */
export function scoreReadAloud(
  payload: ReadAloudPayload,
  response: { transcript: string },
): {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  detail: ReadAloudDetail;
} {
  const target = normalizeSpoken(payload.text);
  const heard = normalizeSpoken(response.transcript);
  const matched = lcs(target, heard);
  const total = target.length;

  // Multiset difference, so a word said twice is not reported missing once.
  const heardCount = new Map<string, number>();
  for (const w of heard) heardCount.set(w, (heardCount.get(w) ?? 0) + 1);
  const missed: string[] = [];
  for (const w of target) {
    const n = heardCount.get(w) ?? 0;
    if (n > 0) heardCount.set(w, n - 1);
    else missed.push(w);
  }
  const extra = [...heardCount].flatMap(([w, n]) => Array.from({ length: n }, () => w));

  return {
    pointsEarned: matched,
    pointsMax: total,
    fraction: total === 0 ? 0 : matched / total,
    detail: {
      target: payload.text,
      transcript: response.transcript,
      matched,
      total,
      missed,
      extra: extra.slice(0, 8),
    },
  };
}
