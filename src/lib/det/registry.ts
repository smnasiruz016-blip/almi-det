// The data-driven task registry — the single place that knows about DET task
// types. Pages, the practice hub, the sidebar, and the submit route all read
// from here; nothing branches on task type with a hand-written if-chain.
//
//   DET_TASKS    — declarative metadata for every task (incl. not-yet-built).
//   DET_HANDLERS — server scoring dispatch for the LIVE tasks. Each handler
//                  parses its own payload/response and returns a normalized
//                  result, so the submit route is a single map lookup.

import type { DetTaskType } from "@prisma/client";
import type { DetSkill, SubscoreKey } from "@/lib/det/types";
import { SKILL_FEEDS } from "@/lib/det/subscores";
import {
  readAndSelectPayloadSchema,
  readAndSelectResponseSchema,
  scoreReadAndSelect,
} from "@/lib/det/tasks/read-and-select";
import {
  interactiveReadingPayloadSchema,
  interactiveReadingResponseSchema,
  scoreInteractiveReading,
} from "@/lib/det/tasks/interactive-reading";
import {
  readAndCompletePayloadSchema,
  readAndCompleteResponseSchema,
  scoreReadAndComplete,
} from "@/lib/det/tasks/read-and-complete";
import {
  writeAboutPhotoPayloadSchema,
  writeAboutPhotoResponseSchema,
  evaluateWriteAboutPhoto,
} from "@/lib/det/tasks/write-about-the-photo";
import {
  listenAndTypePayloadSchema,
  listenAndTypeResponseSchema,
  scoreListenAndType,
} from "@/lib/det/tasks/listen-and-type";
import {
  speakAboutPhotoPayloadSchema,
  speakAboutPhotoResponseSchema,
  evaluateSpeakAboutPhoto,
} from "@/lib/det/tasks/speak-about-the-photo";
import {
  interactiveListeningPayloadSchema,
  interactiveListeningResponseSchema,
  scoreInteractiveListeningObjective,
} from "@/lib/det/tasks/interactive-listening";
import { evaluateConversationSummary } from "@/lib/det/tasks/interactive-listening-ai";
import { readILAnswers, readILProgress } from "@/lib/det/il-stages";

export type ScoringMode = "DETERMINISTIC" | "AI";

export type TaskDef = {
  taskType: DetTaskType;
  slug: string; // URL segment under /practice
  label: string;
  skill: DetSkill;
  scoringMode: ScoringMode;
  feedsSubscores: SubscoreKey[];
  blurb: string; // per-task intro copy (master doc §7)
  live: boolean; // built in v1 (Phase 2) vs planned
};

export const DET_TASKS: Record<DetTaskType, TaskDef> = {
  READ_AND_SELECT: {
    taskType: "READ_AND_SELECT",
    slug: "read-and-select",
    label: "Read and Select",
    skill: "READING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.READING,
    blurb:
      "Mark the words that are real English words and leave the invented ones unmarked — quick reading recognition.",
    live: true,
  },
  READ_AND_COMPLETE: {
    taskType: "READ_AND_COMPLETE",
    slug: "read-and-complete",
    label: "Read and Complete",
    skill: "READING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.READING,
    blurb:
      "A short passage with letters missing from some words. Use the sentence around each gap to work out the word, and type the letters that are missing.",
    live: true,
  },
  INTERACTIVE_READING: {
    taskType: "INTERACTIVE_READING",
    slug: "interactive-reading",
    label: "Interactive Reading",
    skill: "READING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.READING,
    blurb:
      "One passage, several questions: complete the sentences, choose what belongs in a gap, pick out the sentence that answers a question, and judge the main idea and the best title.",
    live: true,
  },
  FILL_IN_THE_BLANKS: {
    taskType: "FILL_IN_THE_BLANKS",
    slug: "fill-in-the-blanks",
    label: "Fill in the Blanks",
    skill: "READING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.READING,
    blurb:
      "One sentence with letters missing from a single word. There is no passage to fall back on — the sentence itself has to tell you which word belongs.",
    live: true,
  },
  LISTEN_AND_TYPE: {
    taskType: "LISTEN_AND_TYPE",
    slug: "listen-and-type",
    label: "Listen and Type",
    skill: "LISTENING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.LISTENING,
    blurb:
      "Listen to a short sentence and type exactly what you hear. Replays are limited, so listen closely.",
    live: true,
  },
  // HYBRID, declared AI on purpose. Parts A and B are marked deterministically,
  // but Part C calls Anthropic — and `scoringMode` is what the submit route
  // reads to decide whether hasPaidAccess() must hold. Declaring this
  // DETERMINISTIC would route a paid AI call around the one chokepoint that
  // gates it, so every free attempt would spend on the rater.
  //
  // `live: false` — the plumbing, the gates and one reference conversation are
  // in; the remaining scenarios and the composer are not. A live task type with
  // one item and no way to answer it is worse than one that says "not yet".
  INTERACTIVE_LISTENING: {
    taskType: "INTERACTIVE_LISTENING",
    slug: "interactive-listening",
    label: "Interactive Listening",
    skill: "LISTENING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.LISTENING,
    blurb:
      "One conversation, three parts: fill the gaps in what you hear, choose the best reply at each turn, then summarize the whole exchange in your own words.",
    live: false,
  },
  WRITE_ABOUT_THE_PHOTO: {
    taskType: "WRITE_ABOUT_THE_PHOTO",
    slug: "write-about-the-photo",
    label: "Write About the Photo",
    skill: "WRITING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.WRITING,
    blurb:
      "Write at least 50 words describing the scene. You'll get honest feedback on relevance, range, and clarity.",
    live: true,
  },
  SPEAK_ABOUT_THE_PHOTO: {
    taskType: "SPEAK_ABOUT_THE_PHOTO",
    slug: "speak-about-the-photo",
    label: "Speak About the Photo",
    skill: "SPEAKING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.SPEAKING,
    blurb:
      "Speak about the scene for up to 90 seconds. We estimate from a transcript of what you said — not from your accent or audio.",
    live: true,
  },
};

export const TASK_ORDER: DetTaskType[] = [
  "READ_AND_SELECT",
  "READ_AND_COMPLETE",
  "INTERACTIVE_READING",
  "FILL_IN_THE_BLANKS",
  "LISTEN_AND_TYPE",
  "INTERACTIVE_LISTENING",
  "WRITE_ABOUT_THE_PHOTO",
  "SPEAK_ABOUT_THE_PHOTO",
];

export function taskBySlug(slug: string): TaskDef | undefined {
  return Object.values(DET_TASKS).find((t) => t.slug === slug);
}

// ---- Server scoring dispatch (LIVE tasks only) ----

export type TaskRunResult = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number; // 0..1 → fed to fractionToRange
  detail?: unknown; // per-task review data for the result page
  feedback?: unknown; // AI trait feedback (productive tasks)
  telemetry?: { aiModel: string; costCents: number; latencyMs: number };
};

export type TaskHandler = {
  mode: ScoringMode;
  run: (input: {
    payload: unknown;
    response: unknown;
    userId: string;
  }) => Promise<TaskRunResult>;
  /**
   * Optional: reconcile what the client just posted with what the server
   * already recorded for this attempt, BEFORE scoring and before persisting.
   *
   * Exists for multi-stage tasks. Interactive Listening records Part A's typed
   * blanks and each turn's choice through /api/det/il/advance as they happen;
   * the final post carries only the summary. Without this hook the submit route
   * would overwrite those stored answers with whatever the last request
   * contained — so a client could replay the whole task with perfect answers in
   * one request, and the stage locks would protect nothing.
   *
   * A hook rather than a task-type branch in the route: the route still does a
   * single map lookup and never asks what kind of task it is holding.
   */
  prepareResponse?: (input: { stored: unknown; incoming: unknown }) => unknown;
};

export const DET_HANDLERS: Partial<Record<DetTaskType, TaskHandler>> = {
  READ_AND_SELECT: {
    mode: "DETERMINISTIC",
    run: async ({ payload, response }) => {
      const p = readAndSelectPayloadSchema.parse(payload);
      const r = readAndSelectResponseSchema.parse(response);
      return scoreReadAndSelect(p, r);
    },
  },
  READ_AND_COMPLETE: {
    mode: "DETERMINISTIC",
    run: async ({ payload, response }) => {
      const p = readAndCompletePayloadSchema.parse(payload);
      const r = readAndCompleteResponseSchema.parse(response);
      return scoreReadAndComplete(p, r);
    },
  },
  INTERACTIVE_READING: {
    mode: "DETERMINISTIC",
    run: async ({ payload, response }) => {
      const p = interactiveReadingPayloadSchema.parse(payload);
      const r = interactiveReadingResponseSchema.parse(response);
      return scoreInteractiveReading(p, r);
    },
  },
  FILL_IN_THE_BLANKS: {
    mode: "DETERMINISTIC",
    run: async ({ payload, response }) => {
      const p = readAndCompletePayloadSchema.parse(payload);
      const r = readAndCompleteResponseSchema.parse(response);
      return scoreReadAndComplete(p, r);
    },
  },
  LISTEN_AND_TYPE: {
    mode: "DETERMINISTIC",
    run: async ({ payload, response }) => {
      const p = listenAndTypePayloadSchema.parse(payload);
      const r = listenAndTypeResponseSchema.parse(response);
      return scoreListenAndType(p, r);
    },
  },
  // The one HYBRID handler. Parts A and B are scored first and locally, so if
  // the rater throws the taker has still lost nothing that was already marked —
  // but the throw is NOT swallowed. A silent fallback to "objective only" would
  // quietly hand back a fraction computed over 9 of 15 points and present it as
  // the task score; the submit route's 500 is the honest outcome.
  INTERACTIVE_LISTENING: {
    mode: "AI",
    // Parts A and B come from the database, not from this request. Only the
    // summary is taken from what the client posted, because Stage C is the one
    // stage that has not been through /api/det/il/advance yet.
    prepareResponse: ({ stored, incoming }) => {
      const prior = readILAnswers(stored);
      const summary = (incoming as { summary?: unknown } | null)?.summary;
      return {
        filled: prior.filled,
        chosen: prior.chosen,
        summary: typeof summary === "string" ? summary : prior.summary,
        progress: readILProgress(stored),
      };
    },
    run: async ({ payload, response, userId }) => {
      const p = interactiveListeningPayloadSchema.parse(payload);
      const r = interactiveListeningResponseSchema.parse(response);
      const objective = scoreInteractiveListeningObjective(p, r);
      const summary = await evaluateConversationSummary({
        payload: p,
        summary: r.summary,
        userId,
      });
      const pointsEarned = objective.pointsEarned + summary.pointsEarned;
      const pointsMax = objective.pointsMax + summary.pointsMax;
      return {
        pointsEarned,
        pointsMax,
        fraction: pointsMax === 0 ? 0 : pointsEarned / pointsMax,
        detail: objective.detail,
        feedback: summary.feedback,
        telemetry: summary.telemetry,
      };
    },
  },
  WRITE_ABOUT_THE_PHOTO: {
    mode: "AI",
    run: async ({ payload, response, userId }) => {
      const p = writeAboutPhotoPayloadSchema.parse(payload);
      const r = writeAboutPhotoResponseSchema.parse(response);
      const s = await evaluateWriteAboutPhoto({ payload: p, response: r, userId });
      return {
        pointsEarned: s.pointsEarned,
        pointsMax: s.pointsMax,
        fraction: s.fraction,
        feedback: s.feedback,
        telemetry: s.telemetry,
      };
    },
  },
  SPEAK_ABOUT_THE_PHOTO: {
    mode: "AI",
    run: async ({ payload, response, userId }) => {
      const p = speakAboutPhotoPayloadSchema.parse(payload);
      const r = speakAboutPhotoResponseSchema.parse(response);
      const s = await evaluateSpeakAboutPhoto({ payload: p, response: r, userId });
      return {
        pointsEarned: s.pointsEarned,
        pointsMax: s.pointsMax,
        fraction: s.fraction,
        feedback: s.feedback,
        telemetry: s.telemetry,
      };
    },
  },
};
