// INTERACTIVE READING (Reading, deterministic).
//
// One passage plus ~6 sub-questions of five kinds. Every kind is answered by
// SELECTING something, so every kind is graded by id match — no AI, no external
// dependency, and the same DeterministicScore shape the other objective tasks
// return, so the submit route and subscore roll-up need no changes.
//
// The sub-kind dispatch below is a TOTAL Record, not a Partial. Adding a
// sub-kind fails to compile until it is graded, exactly as adding a task type
// fails to compile until it has a client-payload projection and a reviewer.
// An unimplemented kind that silently scores zero — or silently scores nothing —
// is the fail-open shape this codebase has spent an audit removing.
//
// All passages and questions are original to AlmiDET.

import { z } from "zod";
import type {
  InteractiveReadingPayload,
  InteractiveReadingResponse,
  IRQuestion,
  IRSubKind,
} from "@/lib/det/types";

const optionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });
const spanSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

const selectQuestionSchema = z.object({
  kind: z.enum([
    "COMPLETE_THE_SENTENCES",
    "COMPLETE_THE_PASSAGE",
    "IDENTIFY_THE_IDEA",
    "TITLE_THE_PASSAGE",
  ]),
  id: z.string().min(1),
  stem: z.string().min(1),
  options: z.array(optionSchema).min(3),
  correctId: z.string().min(1),
});

const highlightQuestionSchema = z.object({
  kind: z.literal("HIGHLIGHT_THE_ANSWER"),
  id: z.string().min(1),
  stem: z.string().min(1),
  correctSpanId: z.string().min(1),
});

export const interactiveReadingPayloadSchema = z.object({
  passage: z.object({ spans: z.array(spanSchema).min(3) }),
  questions: z
    .array(z.discriminatedUnion("kind", [selectQuestionSchema, highlightQuestionSchema]))
    .min(1),
});

export const interactiveReadingResponseSchema = z.object({
  chosen: z.record(z.string(), z.string()),
});

/** What the taker's choice must match, per sub-kind. Total by construction. */
const EXPECTED: Record<IRSubKind, (q: IRQuestion) => string> = {
  COMPLETE_THE_SENTENCES: (q) => (q as { correctId: string }).correctId,
  COMPLETE_THE_PASSAGE: (q) => (q as { correctId: string }).correctId,
  IDENTIFY_THE_IDEA: (q) => (q as { correctId: string }).correctId,
  TITLE_THE_PASSAGE: (q) => (q as { correctId: string }).correctId,
  HIGHLIGHT_THE_ANSWER: (q) => (q as { correctSpanId: string }).correctSpanId,
};

export type InteractiveReadingDetail = {
  questions: {
    id: string;
    kind: IRSubKind;
    stem: string;
    chosen: string;
    expected: string;
    correct: boolean;
    /** Human-readable text of the expected choice, for the review screen. */
    expectedText: string;
    chosenText: string;
  }[];
};

export function scoreInteractiveReading(
  payload: InteractiveReadingPayload,
  response: InteractiveReadingResponse,
): {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  detail: InteractiveReadingDetail;
} {
  const spanText = new Map(payload.passage.spans.map((s) => [s.id, s.text]));

  const questions = payload.questions.map((q) => {
    const expected = EXPECTED[q.kind](q);
    const chosen = response.chosen[q.id] ?? "";
    const label = (id: string): string =>
      q.kind === "HIGHLIGHT_THE_ANSWER"
        ? (spanText.get(id) ?? "")
        : (q.options.find((o) => o.id === id)?.text ?? "");
    return {
      id: q.id,
      kind: q.kind,
      stem: q.stem,
      chosen,
      expected,
      correct: chosen !== "" && chosen === expected,
      expectedText: label(expected),
      chosenText: label(chosen),
    };
  });

  const pointsEarned = questions.filter((q) => q.correct).length;
  const pointsMax = questions.length;
  const fraction = pointsMax === 0 ? 0 : pointsEarned / pointsMax;
  return { pointsEarned, pointsMax, fraction, detail: { questions } };
}
