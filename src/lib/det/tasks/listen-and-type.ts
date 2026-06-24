// LISTEN AND TYPE (Listening, deterministic).
//
// The user hears a short sentence (server-side TTS — the text never reaches the
// client) and types what they heard. Marking is lenient: case- and
// punctuation-insensitive, with single-character typo tolerance, scored on the
// in-order match of words against the original. All sentences are original to
// AlmiDET — never copied from Duolingo.

import { z } from "zod";
import type { ListenAndTypePayload, ListenAndTypeResponse } from "@/lib/det/types";

export const listenAndTypePayloadSchema = z.object({
  sentence: z.string().min(1),
  // What the TTS voice speaks. Defaults to `sentence` when omitted.
  audioScript: z.string().optional(),
});

export const listenAndTypeResponseSchema = z.object({
  typed: z.string(),
});

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Lenient token equality: exact, or one typo apart for words of length >= 4.
function fuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4) return levenshtein(a, b) <= 1;
  return false;
}

// Longest common subsequence length under fuzzy equality — rewards getting the
// words right, in order, while tolerating insertions/omissions.
function fuzzyLcs(expected: string[], got: string[]): number {
  const m = expected.length;
  const n = got.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = fuzzyEqual(expected[i - 1], got[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export type ListenAndTypeDetail = {
  sentence: string;
  typed: string;
  matched: number;
  total: number;
};

export function scoreListenAndType(
  payload: ListenAndTypePayload,
  response: ListenAndTypeResponse,
): {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  detail: ListenAndTypeDetail;
} {
  const expected = normalize(payload.sentence);
  const got = normalize(response.typed);
  const matched = fuzzyLcs(expected, got);
  const total = expected.length;
  const fraction = total === 0 ? 0 : matched / total;
  return {
    pointsEarned: matched,
    pointsMax: total,
    fraction,
    detail: { sentence: payload.sentence, typed: response.typed, matched, total },
  };
}
