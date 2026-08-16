// INTERACTIVE WRITING (Writing, AI) — two prompts, answered in order, Part 1
// final before Part 2 is known.
//
// THE LOCK IS THE TASK. Part 1 asks for a position and a downside; Part 2 asks
// the taker to concede a real advantage of the option they rejected and to
// mitigate the downside they themselves raised. A taker who can read Part 2
// first writes a Part 1 built to be easy to reverse — hedged, downside chosen
// for convenience — and the pair stops measuring anything. So Part 2's prompt is
// SERVER-ONLY until Part 1 is recorded, and Part 1 cannot be resubmitted.
//
// That is the same delivery model Interactive Listening uses and the same
// machinery: src/lib/det/staged.ts, /api/det/staged/advance. This file supplies
// the driver; none of the plumbing is duplicated.
//
// DELIBERATELY FREE OF AI IMPORTS — client-payload.ts imports this for the
// projection, and the content gates run client-payload.ts with no database and
// no network. The rater lives in writing-rater.ts, imported only by the registry
// handler.

import { z } from "zod";
import {
  readStageProgress,
  readStoredAnswers,
  type StageAdvance,
  type StageDriver,
  type StageProgress,
} from "@/lib/det/staged";
import type { InteractiveWritingPayload } from "@/lib/det/types";

// ---------------------------------------------------------------- schema ----

const partSchema = z.object({
  prompt: z.string().min(1),
  minWords: z.number().int().nonnegative(),
});

export const interactiveWritingPayloadSchema = z.object({
  topic: z.string().min(1),
  register: z.string().min(1),
  part1: partSchema,
  part2: partSchema,
  rubric: z.object({
    traits: z.array(z.string().min(1)).min(1),
    reference: z.string().min(1),
  }),
});

export const interactiveWritingResponseSchema = z.object({
  text: z.record(z.string(), z.string()).default({}),
});

export type IWPayload = z.infer<typeof interactiveWritingPayloadSchema>;

// ------------------------------------------------------------- timing ------

/** Part 1: five minutes. Part 2: three. Both from the verified format. */
export const IW_PART1_SECONDS = 300;
export const IW_PART2_SECONDS = 180;

export const IW_PART_KEYS = ["part1", "part2"] as const;
export type IWPartKey = (typeof IW_PART_KEYS)[number];

// ------------------------------------------------------------- progress ----

/** "1" while Part 1 is open, "2" once it is locked. `turn` is unused here — it
 *  exists for tasks that loop inside a stage, which this one does not. */
export const IW_PROGRESS_START: StageProgress = { stage: "1", turn: -1 };

export function readIWProgress(stored: unknown): StageProgress {
  const p = readStageProgress(stored, IW_PROGRESS_START);
  return p.stage === "1" || p.stage === "2" ? p : IW_PROGRESS_START;
}

// ---------------------------------------------------------- projections ----

export type IWPartView = {
  key: IWPartKey;
  prompt: string;
  minWords: number;
  seconds: number;
  /** The taker's own words, so a reload does not lose them. */
  text: string;
  locked: boolean;
};

export type IWView = {
  stage: "1" | "2";
  topic: string;
  register: string;
  /** Always present. Locked read-only once submitted — Part 2 is written WITH
   *  Part 1 in view, which is what makes "mitigate the downside you mentioned"
   *  answerable. */
  part1: IWPartView;
  /** null until Part 1 is recorded. Not merely hidden — absent from the wire. */
  part2: IWPartView | null;
};

/**
 * The view for the taker's current position.
 *
 * A WHITELIST literal at every level: nothing spread from the payload, nothing
 * deleted from a copy. `rubric` is not mentioned at all, so neither the
 * reference nor the trait list can ride along by accident.
 */
export function projectIWView(raw: unknown, input: { stored?: unknown } = {}): IWView {
  const parsed = interactiveWritingPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    // Fail CLOSED — returning anything payload-shaped would undo the point.
    throw new Error(
      `INTERACTIVE_WRITING payload does not parse — refusing to project it. ` +
        `${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const p = parsed.data;
  const progress = readIWProgress(input.stored);
  const { text } = readStoredAnswers(input.stored);
  const locked = progress.stage !== "1";

  return {
    stage: locked ? "2" : "1",
    topic: p.topic,
    register: p.register,
    part1: {
      key: "part1",
      prompt: p.part1.prompt,
      minWords: p.part1.minWords,
      seconds: IW_PART1_SECONDS,
      text: text.part1 ?? "",
      locked,
    },
    part2: locked
      ? {
          key: "part2",
          prompt: p.part2.prompt,
          minWords: p.part2.minWords,
          seconds: IW_PART2_SECONDS,
          text: text.part2 ?? "",
          locked: false,
        }
      : null,
  };
}

// --------------------------------------------------------- state machine ----

export const iwStepSchema = z.object({
  kind: z.literal("part"),
  key: z.enum(IW_PART_KEYS),
  text: z.string(),
});

export type IWStep = z.infer<typeof iwStepSchema>;

/**
 * The only place Part 1 closes.
 *
 * Both rejections are refusals to re-open something already answered: a second
 * Part 1 submission (which is what "locks on submit" means), and a Part 2
 * submission before Part 1 exists. Part 2's own submission does not come through
 * here at all — it is the final submit, which scores.
 */
export function advanceIW(
  payload: IWPayload,
  progress: StageProgress,
  step: IWStep,
): StageAdvance {
  if (step.key === "part1") {
    if (progress.stage !== "1") {
      return {
        ok: false,
        error:
          "Part 1 has already been submitted. It is locked — it cannot be changed now that you " +
          "have seen Part 2.",
      };
    }
    return { ok: true, progress: { stage: "2", turn: -1 }, patch: { text: { part1: step.text } } };
  }

  if (progress.stage === "1") {
    return { ok: false, error: "Finish Part 1 before writing Part 2." };
  }
  // Part 2 is saved but does not advance the stage — the final submit scores it.
  return { ok: true, progress, patch: { text: { part2: step.text } } };
}

export const IW_STAGE_DRIVER: StageDriver = {
  stepSchema: iwStepSchema,
  start: IW_PROGRESS_START,
  advance: (payload, stored, step) =>
    advanceIW(
      interactiveWritingPayloadSchema.parse(payload),
      readIWProgress(stored),
      step as IWStep,
    ),
  project: (payload, ctx) => projectIWView(payload, { stored: ctx.stored }),
};

// ------------------------------------------------------------ scoring ------

/** What the rater is shown, assembled from the payload and the stored answers.
 *  Exported so the review screen can show the same pairing after scoring. */
export function iwSections(
  payload: InteractiveWritingPayload,
  text: Record<string, string>,
): { label: string; prompt: string; text: string; minWords: number }[] {
  return [
    { label: "PART 1", prompt: payload.part1.prompt, text: text.part1 ?? "", minWords: payload.part1.minWords },
    { label: "PART 2", prompt: payload.part2.prompt, text: text.part2 ?? "", minWords: payload.part2.minWords },
  ];
}
