// The ONE place that decides what part of a DetItem.payload may reach the
// browser. Server-only by construction — never import this into a client
// component.
//
// It is a WHITELIST, not a filter. Each task type declares the exact fields it
// projects; anything not named is dropped. The previous implementation ended in
// a bare `return payload`, so a task type it did not recognise shipped its raw
// payload — answer key included. With nine DET question types still to build,
// that default had to be inverted: unknown type => refuse.
//
// Two layers of default-deny:
//
//   COMPILE TIME  PROJECTORS is Record<DetTaskType, Projector> — total, not
//                 Partial. Adding a member to the DetTaskType enum fails to
//                 compile until that member is given a projection. A new task
//                 type cannot reach production without someone deciding, in
//                 this file, what the client is allowed to see.
//
//   RUN TIME      A taskType with no projector throws. Covers the case where the
//                 database holds an enum value this build does not know about
//                 (mid-deploy, or a rolled-back release).
//
// What each type withholds, and why:
//   READ_AND_SELECT        `real` — the answer key itself.
//   READ_AND_COMPLETE      `missingLetters` and `alsoAccept` — the key. Only the
//                          blank's LENGTH crosses to the client.
//   INTERACTIVE_READING    `correctId` / `correctSpanId` — the key. Spans and
//                          options cross in full; which one is right does not.
//   LISTEN_AND_TYPE        everything — the sentence IS the answer; audio is
//                          fetched separately through a server route.
//   WRITE/SPEAK_ABOUT_THE_PHOTO
//                          `imageAlt` — this is not decoration, it is the text
//                          the AI rater judges the response against. Rendering
//                          it as the <img alt> handed the test-taker the exact
//                          sentence they were being scored on; copying it scored
//                          full relevance with no original language produced.
//   INTERACTIVE_LISTENING  FIVE fields, and each one alone would end the task:
//                          `turn.line` is what the audio says — printing it
//                          removes the listening entirely; `turn.correct` and
//                          `complete.text[].missing` are keys; and
//                          `summarize.reference` / `summarize.keyPoints` are the
//                          AI rater's target, the same class of leak as imageAlt.
//                          The options DO cross (the taker must choose among
//                          them) but PERMUTED, and the browser is never told
//                          which position is correct.

import type { DetTaskType } from "@prisma/client";
import {
  segLabelToNumber,
  turnOrder,
  blankId,
  interactiveListeningPayloadSchema,
} from "@/lib/det/tasks/interactive-listening";

export type ClientPayload = Record<string, unknown>;

/**
 * Per-request context a projection may need but the payload does not carry.
 *
 * `audio` maps DetItemAudio.seg -> public Blob URL. audioUrl is DB-ONLY: it is
 * never authored in a seed and never stored in a payload, so a task whose
 * stimulus IS audio can only be assembled here, at the render seam, from a row
 * the generator wrote. An absent entry projects null, and the composer shows
 * "audio not ready" rather than an item that looks answerable and is not.
 */
export type ProjectionContext = { audio?: Record<number, string> };

type Projector = (
  payload: Record<string, unknown>,
  ctx: ProjectionContext,
) => ClientPayload;

/** Cloze projection: drop missingLetters and alsoAccept, keep only the COUNT.
 *  Shared by READ_AND_COMPLETE (passage scope) and FILL_IN_THE_BLANKS (sentence
 *  scope) — same payload shape, same key to withhold, so one projector. */
const projectCloze: Projector = (p) => ({
  passage: ((p.passage as Record<string, unknown>[] | undefined) ?? []).map((t) =>
    t.kind === "blank"
      ? {
          kind: "blank",
          id: t.id,
          visiblePrefix: t.visiblePrefix,
          blankLength: String(t.missingLetters ?? "").length,
          suffix: t.suffix,
        }
      : { kind: "text", text: t.text },
  ),
});

/**
 * INTERACTIVE_LISTENING.
 *
 * Built as a WHITELIST literal — every field named below is one someone decided
 * the browser may have. Nothing is spread, nothing is deleted from a copy: a
 * delete-based projection ships whatever field an author adds next.
 *
 * Part A projects the literal chunks and a bare `{kind:"blank", id}` marker.
 * Note what is NOT there: no visiblePrefix and no blankLength, both of which the
 * reading cloze DOES project. Here the audio supplies the word, so a prefix or a
 * letter count would let the gap be solved by spelling instead of by listening —
 * it would be a reading item wearing a listening item's name.
 *
 * Part B projects each turn's options through turnOrder(), and emits the
 * `index` the client must post back. It does not emit which position is right;
 * the server re-derives the permutation at grading time.
 */
const projectInteractiveListening: Projector = (raw, ctx) => {
  const parsed = interactiveListeningPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    // Fail CLOSED. Returning the raw payload here would undo the whole file.
    throw new Error(
      `INTERACTIVE_LISTENING payload does not parse — refusing to project it. ` +
        `${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const p = parsed.data;
  const audio = ctx.audio ?? {};

  let blanks = 0;
  const text = p.complete.text.map((c) =>
    typeof c === "string"
      ? { kind: "text" as const, text: c }
      : { kind: "blank" as const, id: blankId(blanks++) },
  );

  return {
    scenario: {
      register: p.scenario.register,
      setting: p.scenario.setting,
      speakerName: p.scenario.speakerName,
      youAre: p.scenario.youAre,
    },
    complete: {
      audioUrl: audio[segLabelToNumber(p.complete.seg)] ?? null,
      text,
    },
    turns: p.turns.map((t, i) => ({
      index: i,
      opener: Boolean(t.opener),
      audioUrl: t.seg === null ? null : (audio[segLabelToNumber(t.seg)] ?? null),
      options: turnOrder(p, i).map((authored) => t.options[authored]),
    })),
    summarize: { prompt: p.summarize.prompt },
  };
};

const PROJECTORS: Record<DetTaskType, Projector> = {
  READ_AND_SELECT: (p) => ({
    words: ((p.words as { id: string; text: string }[] | undefined) ?? []).map((w) => ({
      id: w.id,
      text: w.text,
    })),
  }),

  READ_AND_COMPLETE: projectCloze,
  FILL_IN_THE_BLANKS: projectCloze,

  // Projects the passage spans in full (the taker must read them, and uniform
  // spans are what keep Highlight the Answer honest) and every option in full
  // (the taker must choose among them) — while dropping correctId /
  // correctSpanId. The key is an ID, so it is short: gate:leak checks the
  // projected objects FIELD BY FIELD rather than scanning the wire for a
  // substring, which a two-character id would trip on immediately.
  INTERACTIVE_READING: (p) => {
    const passage = (p.passage as { spans?: Record<string, unknown>[] } | undefined) ?? {};
    return {
      passage: {
        spans: (passage.spans ?? []).map((s) => ({ id: s.id, text: s.text })),
      },
      questions: ((p.questions as Record<string, unknown>[] | undefined) ?? []).map((q) =>
        q.kind === "HIGHLIGHT_THE_ANSWER"
          ? { kind: q.kind, id: q.id, stem: q.stem }
          : {
              kind: q.kind,
              id: q.id,
              stem: q.stem,
              options: ((q.options as Record<string, unknown>[] | undefined) ?? []).map((o) => ({
                id: o.id,
                text: o.text,
              })),
            },
      ),
    };
  },

  LISTEN_AND_TYPE: () => ({}),

  INTERACTIVE_LISTENING: projectInteractiveListening,

  WRITE_ABOUT_THE_PHOTO: (p) => ({
    imageUrl: p.imageUrl,
    minWords: p.minWords,
  }),

  SPEAK_ABOUT_THE_PHOTO: (p) => ({
    imageUrl: p.imageUrl,
    prepSeconds: p.prepSeconds,
    speakSeconds: p.speakSeconds,
  }),
};

/**
 * Project a stored payload down to the fields the browser is allowed to see.
 * Throws for any task type without an explicit projection — never returns the
 * raw payload as a fallback.
 */
export function toClientPayload(
  taskType: DetTaskType,
  payload: unknown,
  ctx: ProjectionContext = {},
): ClientPayload {
  const project = (PROJECTORS as Partial<Record<DetTaskType, Projector>>)[taskType];
  if (!project) {
    throw new Error(
      `No client-payload projection for task type "${taskType}". Refusing to send the raw ` +
        `payload — add an explicit projection in src/lib/det/client-payload.ts.`,
    );
  }
  return project((payload ?? {}) as Record<string, unknown>, ctx);
}

/** Task types with an explicit projection. Read by gate:leak. */
export function projectedTaskTypes(): string[] {
  return Object.keys(PROJECTORS);
}
