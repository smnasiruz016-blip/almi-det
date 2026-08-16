// INTERACTIVE LISTENING — the progressive delivery model.
//
// This is the module that decides WHAT THE TAKER IS CURRENTLY ENTITLED TO SEE,
// and it is the reason Interactive Listening does not ship its own test to the
// browser.
//
// THE PROBLEM WITH ONE PAYLOAD. Every other DET task type projects its whole
// stimulus at once, which is fine when the stimulus is a passage or a photo —
// the taker is meant to have all of it. A conversation is not like that. It has
// an ORDER, and the order is load-bearing:
//
//   · Part A's gaps must be typed from the audio. If the reply options for
//     turns 2-5 are already on the wire, several of them name the words that
//     were blanked ("The library usually closes at five-thirty"), and Part A
//     becomes a word-search through the payload.
//   · Real DET plays each turn's audio ONCE. A payload that carries every clip
//     URL up front makes "once" a UI convention rather than a fact.
//   · The summary prompt tells the taker what to listen FOR. Handing it over at
//     the start changes the task.
//
// So the view is built PER STAGE, from stored progress the server owns:
//
//   Stage A   scenario + gapped transcript + the scenario clip. No turns, no
//             options, no summary prompt exist in this payload at all.
//   Stage B   the CURRENT turn only — its clip URL and its options. Turn N+1
//             does not exist on the wire until turn N is answered.
//   Stage C   the summary prompt and its countdown.
//
// The transcript stays visible after Stage A with the taker's own words locked
// into it, because they need the context to follow the conversation. The
// scenario CLIP does not: once Stage A is submitted that listening is over, so
// its URL stops being projected.
//
// WHAT THIS STILL DOES NOT CLOSE. Blob audio is stored `access: "public"`, so a
// URL that has been released can be re-fetched by anyone who reads it out of the
// network tab. Progressive delivery makes "listen once" true for the honest path
// and narrows the dishonest one to a single already-reached turn — it does not
// make replay impossible. Short-lived signed URLs would; that needs private Blob
// and is not in this change.
//
// Import-light on purpose: client-payload.ts imports this, and the content gates
// execute client-payload.ts with no database and no network.

import { z } from "zod";
import type { StageDriver } from "@/lib/det/staged";
import {
  interactiveListeningPayloadSchema,
  ilProgressSchema,
  IL_PROGRESS_START,
  segLabelToNumber,
  isValidSegLabel,
  turnOrder,
  blankId,
  type ILProgress,
} from "@/lib/det/tasks/interactive-listening";

/** How long the taker gets for the summary, in seconds. */
export const IL_SUMMARY_SECONDS = 75;

// ------------------------------------------------------------- view types ---

export type ILChunkView = { kind: "text"; text: string } | { kind: "blank"; id: string };

export type ILTurnView = {
  kind: "turn";
  index: number;
  total: number;
  opener: boolean;
  /** null for the opener, and null when the clip has not been rendered yet. */
  audioUrl: string | null;
  /** Permuted. Which one is correct is never sent. */
  options: string[];
};

export type ILSummarizeView = {
  kind: "summarize";
  prompt: string;
  seconds: number;
};

export type ILView = {
  stage: "A" | "B" | "C";
  scenario: {
    register: string;
    setting: string;
    speakerName: string;
    youAre: string;
  };
  complete: {
    /** Withheld once Stage A is submitted — that listening is finished. */
    audioUrl: string | null;
    text: ILChunkView[];
    /** The taker's OWN typed answers, so a page reload does not lose them. */
    filled: Record<string, string>;
    locked: boolean;
  };
  /** The one thing the taker may act on now. null while still in Stage A. */
  current: ILTurnView | ILSummarizeView | null;
};

export type ILProjectionInput = {
  /** DetItemAudio.seg -> public Blob URL. */
  audio?: Record<number, string>;
  /** DetAttempt.response as stored. */
  stored?: unknown;
};

// ------------------------------------------------------------- progress -----

/** Progress as the server recorded it, or the start state. Never throws: an
 *  unreadable response means the attempt has not begun, not that it is broken. */
export function readILProgress(stored: unknown): ILProgress {
  if (!stored || typeof stored !== "object") return IL_PROGRESS_START;
  const parsed = ilProgressSchema.safeParse((stored as Record<string, unknown>).progress);
  return parsed.success ? parsed.data : IL_PROGRESS_START;
}

/** The taker's own recorded answers. Their data, safe to hand back. */
export function readILAnswers(stored: unknown): {
  filled: Record<string, string>;
  chosen: Record<string, number>;
  summary: string;
} {
  const s = (stored ?? {}) as Record<string, unknown>;
  const filled: Record<string, string> = {};
  const chosen: Record<string, number> = {};
  for (const [k, v] of Object.entries((s.filled ?? {}) as Record<string, unknown>)) {
    if (typeof v === "string") filled[k] = v;
  }
  for (const [k, v] of Object.entries((s.chosen ?? {}) as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isInteger(v)) chosen[k] = v;
  }
  return { filled, chosen, summary: typeof s.summary === "string" ? s.summary : "" };
}

// ---------------------------------------------------------- projections -----

type Payload = ReturnType<typeof interactiveListeningPayloadSchema.parse>;

function audioFor(label: string | null, audio: Record<number, string>): string | null {
  if (label === null || !isValidSegLabel(label)) return null;
  return audio[segLabelToNumber(label)] ?? null;
}

/**
 * ONE turn, permuted. Exported because gate:il-leak and gate:il-options check
 * this projection directly — the turns never pass through toClientPayload(), so
 * a gate that only looked there would be blind to the half of the wire that
 * carries the conversation.
 */
export function projectILTurn(
  payload: Payload,
  index: number,
  audio: Record<number, string> = {},
): ILTurnView | null {
  const t = payload.turns[index];
  if (!t) return null;
  return {
    kind: "turn",
    index,
    total: payload.turns.length,
    opener: Boolean(t.opener),
    audioUrl: audioFor(t.seg, audio),
    options: turnOrder(payload, index).map((authored) => t.options[authored]),
  };
}

export function projectILSummarize(payload: Payload): ILSummarizeView {
  return {
    kind: "summarize",
    prompt: payload.summarize.prompt,
    seconds: IL_SUMMARY_SECONDS,
  };
}

/**
 * The whole view for the taker's current position.
 *
 * Built as a WHITELIST literal at every level — nothing is spread from the
 * payload and nothing is deleted from a copy, so a field an author adds later
 * cannot ride along.
 */
export function projectILView(raw: unknown, input: ILProjectionInput = {}): ILView {
  const parsed = interactiveListeningPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    // Fail CLOSED. Returning anything payload-shaped here would undo the point.
    throw new Error(
      `INTERACTIVE_LISTENING payload does not parse — refusing to project it. ` +
        `${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const p = parsed.data;
  const audio = input.audio ?? {};
  const progress = readILProgress(input.stored);
  const { filled } = readILAnswers(input.stored);

  let blanks = 0;
  const text: ILChunkView[] = p.complete.text.map((c) =>
    typeof c === "string"
      ? { kind: "text", text: c }
      : { kind: "blank", id: blankId(blanks++) },
  );

  let current: ILView["current"] = null;
  if (progress.stage === "B") current = projectILTurn(p, progress.turn, audio);
  else if (progress.stage === "C") current = projectILSummarize(p);

  return {
    stage: progress.stage,
    scenario: {
      register: p.scenario.register,
      setting: p.scenario.setting,
      speakerName: p.scenario.speakerName,
      youAre: p.scenario.youAre,
    },
    complete: {
      // Stage A's clip is released only during Stage A.
      audioUrl: progress.stage === "A" ? audioFor(p.complete.seg, audio) : null,
      text,
      filled,
      locked: progress.stage !== "A",
    },
    current,
  };
}

// ------------------------------------------------------- the state machine --

/** The step bodies /api/det/staged/advance accepts for this task. Lives here
 *  rather than in the route so the shape and the state machine that consumes it
 *  cannot drift apart. */
export const ilStepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("complete"),
    filled: z.record(z.string(), z.string()),
  }),
  z.object({
    kind: z.literal("turn"),
    index: z.number().int().nonnegative(),
    // The DISPLAYED position, not the authored index and never the key. The
    // server re-derives the permutation to map it home.
    chosen: z.number().int().nonnegative(),
  }),
]);

export type ILStep =
  | { kind: "complete"; filled: Record<string, string> }
  | { kind: "turn"; index: number; chosen: number };

export type ILAdvance =
  | { ok: true; progress: ILProgress; patch: { filled?: Record<string, string>; chosen?: Record<string, number> } }
  | { ok: false; error: string };

/**
 * The ONLY place a stage boundary is crossed.
 *
 * Every rejection is a refusal to re-open something already answered:
 *   · a second Stage A submission, which would let the blanks be revised after
 *     the conversation has been heard — the whole reason the lock exists;
 *   · a turn other than the one currently released, which would let a taker
 *     answer turn 4 without hearing turns 2 and 3.
 *
 * Returns a PATCH rather than writing, so the route owns the single database
 * write and this function stays pure and testable.
 */
export function advanceIL(payload: Payload, progress: ILProgress, step: ILStep): ILAdvance {
  if (step.kind === "complete") {
    if (progress.stage !== "A") {
      return {
        ok: false,
        error:
          "Part 1 has already been submitted. Your typed answers are locked — they cannot be " +
          "changed after the conversation starts.",
      };
    }
    return {
      ok: true,
      progress: { stage: "B", turn: 0 },
      patch: { filled: step.filled },
    };
  }

  if (progress.stage === "A") {
    return { ok: false, error: "Finish Part 1 before replying to the conversation." };
  }
  if (progress.stage === "C") {
    return { ok: false, error: "The conversation is finished. Write your summary to submit." };
  }
  if (step.index !== progress.turn) {
    return {
      ok: false,
      error: `Turn ${progress.turn + 1} is the current turn; turn ${step.index + 1} is not available.`,
    };
  }

  const last = step.index + 1 >= payload.turns.length;
  return {
    ok: true,
    progress: last ? { stage: "C", turn: step.index } : { stage: "B", turn: step.index + 1 },
    patch: { chosen: { [String(step.index)]: step.chosen } },
  };
}

/**
 * This task type's entry in the staged-task registry. The advance route holds
 * nothing Interactive Listening-specific; it looks this up and calls it.
 */
export const IL_STAGE_DRIVER: StageDriver = {
  stepSchema: ilStepSchema,
  start: IL_PROGRESS_START,
  // The scenario clip and each turn's clip come from DetItemAudio.
  needsAudio: true,
  advance: (payload, stored, step) =>
    advanceIL(
      interactiveListeningPayloadSchema.parse(payload),
      readILProgress(stored),
      step as ILStep,
    ),
  project: (payload, ctx) => projectILView(payload, ctx),
};
