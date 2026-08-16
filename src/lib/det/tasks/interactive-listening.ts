// INTERACTIVE LISTENING — shape, audio segments, option permutation, and the
// deterministic half of the grading (Parts A and B).
//
// DELIBERATELY FREE OF AI IMPORTS. src/lib/det/client-payload.ts imports this
// module for the permutation, and client-payload.ts is executed by gate:leak in
// a no-database, no-network process. Pulling the Anthropic client in here would
// drag prisma and the SDK into the gate's import graph for the sake of one pure
// function. Part C's rater therefore lives next door in
// interactive-listening-ai.ts and is imported only by the registry handler.
//
// All conversations are original to AlmiDET — never copied from Duolingo.

import { z } from "zod";
import type {
  ILCompleteChunk,
  ILTurn,
  InteractiveListeningPayload,
  InteractiveListeningResponse,
} from "@/lib/det/types";

// ---------------------------------------------------------------- schema ----

const completeChunkSchema = z.union([
  z.string().min(1),
  z.object({
    missing: z.string().min(1),
    alsoAccept: z.array(z.string().min(1)).optional(),
  }),
]);

const turnSchema = z.object({
  seg: z.string().min(1).nullable(),
  opener: z.boolean().optional(),
  line: z.string().min(1).nullable(),
  options: z.array(z.string().min(1)).min(3),
  correct: z.number().int().nonnegative(),
});

export const interactiveListeningPayloadSchema = z.object({
  scenario: z.object({
    register: z.string().min(1),
    setting: z.string().min(1),
    speakerName: z.string().min(1),
    youAre: z.string().min(1),
  }),
  complete: z.object({
    seg: z.string().min(1),
    text: z.array(completeChunkSchema).min(1),
    audioScript: z.string().min(1).optional(),
  }),
  turns: z.array(turnSchema).min(2),
  summarize: z.object({
    prompt: z.string().min(1),
    reference: z.string().min(1),
    keyPoints: z.array(z.string().min(1)).min(1),
  }),
});

export const interactiveListeningResponseSchema = z.object({
  filled: z.record(z.string(), z.string()).default({}),
  chosen: z.record(z.string(), z.number().int()).default({}),
  summary: z.string().default(""),
});

// ------------------------------------------------------- audio segments ----

/**
 * Audio segment LABEL -> the integer DetItemAudio keys on.
 *
 *   "scenario" -> 0        the Part A clip
 *   "turn-N"   -> N        N >= 1, so it can never collide with the scenario
 *
 * Total and injective by construction. This is the whole reason Interactive
 * Listening needs no audio migration: DetItemAudio was built with an integer
 * `seg` for exactly this, and a label is only the authoring surface.
 *
 * Throws rather than falling back to 0. A silent fallback would map two
 * different clips onto the same (itemId, seg) row, and the second upload would
 * overwrite the first — the conversation would play one clip twice.
 */
export function segLabelToNumber(label: string): number {
  if (label === "scenario") return 0;
  const m = /^turn-(\d+)$/.exec(label);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  throw new Error(
    `Unknown Interactive Listening audio segment label "${label}". ` +
      `Expected "scenario" or "turn-N" with N >= 1.`,
  );
}

/** True when the label is one segLabelToNumber() accepts — for gates, which
 *  want to REPORT a bad label rather than die on the first one. */
export function isValidSegLabel(label: string): boolean {
  try {
    segLabelToNumber(label);
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------- Part A helpers ----

/** The blank ids the grader and the projection both use, derived from position
 *  so the author never writes one and the two sides can never disagree. */
export function blankId(index: number): string {
  return `b${index + 1}`;
}

export function completeBlanks(
  chunks: ILCompleteChunk[],
): { id: string; missing: string; alsoAccept: string[]; at: number }[] {
  const out: { id: string; missing: string; alsoAccept: string[]; at: number }[] = [];
  chunks.forEach((c, at) => {
    if (typeof c === "string") return;
    out.push({ id: blankId(out.length), missing: c.missing, alsoAccept: c.alsoAccept ?? [], at });
  });
  return out;
}

/** The transcript as written — literal chunks and blanked words concatenated
 *  with NOTHING between them. Spacing belongs to the literal chunks, which is
 *  what makes "no prefix reveal" checkable: if a chunk ends mid-word, the gap is
 *  a fragment rather than a word. */
export function assembleTranscript(chunks: ILCompleteChunk[]): string {
  return chunks.map((c) => (typeof c === "string" ? c : c.missing)).join("");
}

/** What the voice actually says for the scenario clip. */
export function spokenScenario(payload: InteractiveListeningPayload): string {
  return (payload.complete.audioScript ?? assembleTranscript(payload.complete.text)).trim();
}

// ------------------------------------------------- option permutation ------
//
// Options are authored with the key wherever it reads most naturally (in
// practice, first). What the taker sees is a per-turn permutation, and the
// browser is never told which position is correct — it posts back the position
// it displayed, and the server maps it home.
//
// The permutation is a ROTATION with a per-item phase, and that is a deliberate
// choice over a seeded shuffle:
//
//   BALANCE BY CONSTRUCTION. Consecutive turns place the key at consecutive
//   positions, so within one item the key's position is spread as evenly as the
//   option count allows. A seeded Fisher-Yates gives no such guarantee — with
//   five turns it can land three keys in one position by chance, which is
//   exactly the position tell gate:il-options exists to catch.
//
//   PHASE VARIES PER ITEM. A rotation keyed only on the turn index would put
//   every item's first key in position 1 — a per-item fix that installs a
//   cross-item pattern. The phase is hashed from the scenario, so item to item
//   the ladder starts somewhere else.
//
// Derived entirely from the payload, so projection and grading compute the same
// permutation without storing it.

/** FNV-1a. Small, dependency-free, and stable across processes — a
 *  String.hashCode-style sum would collide on anagrams of a setting. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function scenarioPhase(payload: InteractiveListeningPayload): number {
  return hash32(`${payload.scenario.speakerName}|${payload.scenario.setting}`);
}

/**
 * The display order for one turn: `order[displayPosition] = authoredIndex`.
 * Apply it to project; index into it to grade.
 */
export function turnOrder(payload: InteractiveListeningPayload, turnIndex: number): number[] {
  const turn = payload.turns[turnIndex];
  const n = turn.options.length;
  if (n === 0) return [];
  // Where the key should land for this turn.
  const target = (scenarioPhase(payload) + turnIndex) % n;
  const shift = (((turn.correct - target) % n) + n) % n;
  return Array.from({ length: n }, (_, i) => (i + shift) % n);
}

/** The position the taker sees the key in — what gate:il-options measures. */
export function displayedCorrectPosition(
  payload: InteractiveListeningPayload,
  turnIndex: number,
): number {
  return turnOrder(payload, turnIndex).indexOf(payload.turns[turnIndex].correct);
}

// ------------------------------------------------------------- grading ----

/** Case- and whitespace-insensitive, same promise the reading cloze makes. */
function normalizeWord(s: string): string {
  return s.trim().toLowerCase();
}

export type InteractiveListeningDeterministicDetail = {
  blanks: { id: string; missing: string; typed: string; correct: boolean }[];
  turns: {
    index: number;
    opener: boolean;
    /** Server-side review data — safe here, this runs AFTER submission. */
    line: string | null;
    chosenText: string;
    correctText: string;
    correct: boolean;
  }[];
};

/**
 * Parts A and B. No AI, no network — the objective half of the task, scored the
 * same way whether or not Part C's rater is reachable.
 */
export function scoreInteractiveListeningObjective(
  payload: InteractiveListeningPayload,
  response: InteractiveListeningResponse,
): {
  pointsEarned: number;
  pointsMax: number;
  detail: InteractiveListeningDeterministicDetail;
} {
  // ---- A: typed vs the blanked word (+ alsoAccept) ----
  const blanks = completeBlanks(payload.complete.text).map((b) => {
    const typed = response.filled[b.id] ?? "";
    const accepted = new Set([b.missing, ...b.alsoAccept].map(normalizeWord));
    return {
      id: b.id,
      missing: b.missing,
      typed,
      correct: accepted.has(normalizeWord(typed)),
    };
  });

  // ---- B: displayed position -> authored index -> key ----
  const turns = payload.turns.map((t: ILTurn, i) => {
    const order = turnOrder(payload, i);
    const displayed = response.chosen[String(i)];
    const authored =
      typeof displayed === "number" && displayed >= 0 && displayed < order.length
        ? order[displayed]
        : -1;
    return {
      index: i,
      opener: Boolean(t.opener),
      line: t.line,
      chosenText: authored >= 0 ? (t.options[authored] ?? "") : "",
      correctText: t.options[t.correct] ?? "",
      correct: authored === t.correct,
    };
  });

  const pointsEarned =
    blanks.filter((b) => b.correct).length + turns.filter((t) => t.correct).length;
  const pointsMax = blanks.length + turns.length;

  return { pointsEarned, pointsMax, detail: { blanks, turns } };
}
