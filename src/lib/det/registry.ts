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
  writeAboutPhotoPayloadSchema,
  writeAboutPhotoResponseSchema,
  evaluateWriteAboutPhoto,
} from "@/lib/det/tasks/write-about-the-photo";

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
      "Mark the words that are real English words and leave the invented ones unmarked. Quick reading recognition.",
    live: true,
  },
  LISTEN_AND_TYPE: {
    taskType: "LISTEN_AND_TYPE",
    slug: "listen-and-type",
    label: "Listen and Type",
    skill: "LISTENING",
    scoringMode: "DETERMINISTIC",
    feedsSubscores: SKILL_FEEDS.LISTENING,
    blurb: "Listen to a short sentence and type exactly what you hear.",
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
      "Write at least 50 words describing the photo. You'll get honest feedback on relevance, range, and clarity.",
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
      "Speak about the photo for up to 90 seconds. We estimate from a transcript of what you said — not your accent.",
    live: false,
  },
};

export const TASK_ORDER: DetTaskType[] = [
  "READ_AND_SELECT",
  "LISTEN_AND_TYPE",
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
};
