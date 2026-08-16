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
import {
  interactiveWritingPayloadSchema,
  interactiveWritingResponseSchema,
  iwSections,
  readIWProgress,
} from "@/lib/det/tasks/interactive-writing";
import {
  writingSamplePayloadSchema,
  writingSampleResponseSchema,
  WS_MIN_WORDS,
} from "@/lib/det/tasks/writing-sample";
import { evaluateWriting } from "@/lib/det/tasks/writing-rater";
import { readStoredAnswers } from "@/lib/det/staged";

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
  // `live: false` — and no longer for want of content. All 12 conversations are
  // authored and green on every gate, and the composer is built. It stays dark
  // because the type is not IN THE DATABASE: migrations 4-7 are unapplied, the
  // items are unseeded, and none of the 60 clips are rendered. Flipping this
  // before that chain runs offers a task whose pool is empty.
  // Order, and it is not optional: migrate deploy -> seed -> audio:render ->
  // live: true. See docs/DEPLOY-RUNBOOK.md.
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
  // PROGRESSIVE, like Interactive Listening — Part 1 locks before Part 2's
  // prompt exists on the wire. live: false until the deferred deploy chain runs
  // (migrate -> seed -> live); one reference item is a proof, not a bank.
  INTERACTIVE_WRITING: {
    taskType: "INTERACTIVE_WRITING",
    slug: "interactive-writing",
    label: "Interactive Writing",
    skill: "WRITING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.WRITING,
    blurb:
      "Two linked prompts. Write your view first — it locks when you submit — then answer a follow-up that asks you to argue the other side fairly.",
    live: false,
  },
  // In the official DET this sample is sent to institutions UNSCORED. We rate it
  // because this is a practice tool and feedback is the point; the composer says
  // so on screen, and the sentence is carried in the PROJECTION so a redesign
  // cannot quietly drop it.
  WRITING_SAMPLE: {
    taskType: "WRITING_SAMPLE",
    slug: "writing-sample",
    label: "Writing Sample",
    skill: "WRITING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.WRITING,
    blurb:
      "Read the prompt for 30 seconds, then write 100-130+ words in five minutes. The real test sends this to universities unscored — here you get feedback on it.",
    live: false,
  },
  // DETERMINISTIC and PAID — the two are not in tension here. Grading is
  // arithmetic on two strings, so `scoringMode` is honest; the paid gate comes
  // from being a SPEAKING task, which both submit routes check independently of
  // scoringMode. Labelling it "AI" to buy the paid gate would have been a lie
  // about how it is marked.
  READ_ALOUD: {
    taskType: "READ_ALOUD",
    slug: "read-aloud",
    label: "Read Aloud",
    skill: "SPEAKING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.SPEAKING,
    blurb:
      "Read one sentence aloud. We transcribe the recording and check it word by word against the sentence — this measures what was heard, not your accent.",
    live: false,
  },
  // The three rubric-based speaking types. All AI, all paid — the paid gate and
  // the daily cap come from being SPEAKING tasks, checked by both submit routes.
  // Each rates a TRANSCRIPT: the blurbs say so, because a learner reading
  // "speaking score" will otherwise hear "accent score".
  READ_THEN_SPEAK: {
    taskType: "READ_THEN_SPEAK",
    slug: "read-then-speak",
    label: "Read Then Speak",
    skill: "SPEAKING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.SPEAKING,
    blurb:
      "Read a prompt on screen, then speak about it for up to 90 seconds. We rate the ideas, flow, vocabulary and grammar from a transcript — not your accent.",
    live: false,
  },
  LISTEN_THEN_SPEAK: {
    taskType: "LISTEN_THEN_SPEAK",
    slug: "listen-then-speak",
    label: "Listen Then Speak",
    skill: "SPEAKING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.SPEAKING,
    blurb:
      "Listen to a spoken question — there is no text to read — then answer it aloud for up to 90 seconds. Understanding the question by ear is part of the task.",
    live: false,
  },
  SPEAKING_SAMPLE: {
    taskType: "SPEAKING_SAMPLE",
    slug: "speaking-sample",
    label: "Speaking Sample",
    skill: "SPEAKING",
    scoringMode: "AI",
    feedsSubscores: SKILL_FEEDS.SPEAKING,
    blurb:
      "Speak for up to three minutes on one topic. The real test sends this to universities unscored; here you get feedback on it.",
    live: false,
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
  "INTERACTIVE_WRITING",
  "WRITING_SAMPLE",
  "READ_ALOUD",
  "READ_THEN_SPEAK",
  "LISTEN_THEN_SPEAK",
  "SPEAKING_SAMPLE",
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
   * blanks and each turn's choice through /api/det/staged/advance as they happen;
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
    // stage that has not been through /api/det/staged/advance yet.
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
  // Both Writing rubric types share one rater (writing-rater.ts): same four
  // traits, same honesty rules, one place to change them.
  INTERACTIVE_WRITING: {
    mode: "AI",
    // Part 1 comes from the database, not from this request — it was locked by
    // /api/det/staged/advance and must not be revisable by the final post. Part
    // 2 is taken from the post OR from what was saved as it was typed.
    prepareResponse: ({ stored, incoming }) => {
      const prior = readStoredAnswers(stored);
      const posted = (incoming as { text?: Record<string, unknown> } | null)?.text ?? {};
      const part2 = typeof posted.part2 === "string" ? posted.part2 : prior.text.part2;
      return {
        text: { part1: prior.text.part1 ?? "", part2: part2 ?? "" },
        progress: readIWProgress(stored),
      };
    },
    run: async ({ payload, response, userId }) => {
      const p = interactiveWritingPayloadSchema.parse(payload);
      const r = interactiveWritingResponseSchema.parse(response);
      const s = await evaluateWriting({
        feature: "interactive-writing.evaluate",
        pointsMax: 12,
        reference: p.rubric.reference,
        context: `TOPIC: ${p.topic}
REGISTER: ${p.register}
This is a TWO-PART task: Part 2 asks the candidate to concede a genuine advantage of the option they did NOT choose in Part 1, and to mitigate the downside they themselves raised. Judge whether Part 2 actually engages with Part 1.`,
        sections: iwSections(p, r.text),
        minTotalWords: p.part1.minWords + p.part2.minWords,
        userId,
      });
      return {
        pointsEarned: s.pointsEarned,
        pointsMax: s.pointsMax,
        fraction: s.fraction,
        feedback: s.feedback,
        telemetry: s.telemetry,
      };
    },
  },
  WRITING_SAMPLE: {
    mode: "AI",
    run: async ({ payload, response, userId }) => {
      const p = writingSamplePayloadSchema.parse(payload);
      const r = writingSampleResponseSchema.parse(response);
      const s = await evaluateWriting({
        feature: "writing-sample.evaluate",
        pointsMax: 12,
        reference: p.rubric.reference,
        context: `CATEGORY: ${p.category}
TOPIC: ${p.topic}
TARGET LENGTH: ${p.targetWords}
Note: in the official DET this sample is sent to institutions unscored. This rating is practice feedback only.`,
        sections: [{ label: "RESPONSE", prompt: p.prompt, text: r.text }],
        minTotalWords: WS_MIN_WORDS,
        userId,
      });
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
