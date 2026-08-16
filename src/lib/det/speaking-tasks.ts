// The speaking-task registry.
//
// Its own module so the dependency runs one way: task modules import the generic
// contract from speaking.ts, and only this file imports the task modules. Same
// arrangement as staged-drivers.ts, and for the same reason.
//
// PARTIAL, not total. Most task types are not spoken, and requiring an entry for
// each of them would be noise that teaches people to paste a stub. A task type
// absent from this map is simply not a speaking task — and `isSpeakingTask()` is
// what the paid gate and the daily cap key off, so being absent is safe by
// default rather than dangerous.

import type { DetTaskType } from "@prisma/client";
import type { SpeakingTask } from "@/lib/det/speaking";
import { readAloudPayloadSchema, scoreReadAloud } from "@/lib/det/tasks/read-aloud";

export const SPEAKING_TASKS: Partial<Record<DetTaskType, SpeakingTask>> = {
  READ_ALOUD: {
    taskType: "READ_ALOUD",
    transcribeFeature: "read-aloud.transcribe",
    // Comfortably more than the 8-11 word sentences need; the composer stops
    // recording at this, so it also bounds what any one attempt can be billed.
    recordSeconds: 30,
    grade: async ({ transcript, payload }) => {
      const p = readAloudPayloadSchema.parse(payload);
      const s = scoreReadAloud(p, { transcript });
      return {
        pointsEarned: s.pointsEarned,
        pointsMax: s.pointsMax,
        fraction: s.fraction,
        detail: s.detail,
      };
    },
  },

  // SPEAK_ABOUT_THE_PHOTO is a speaking task and is listed here so the paid gate
  // and the daily cap cover it, but it keeps its own grader and submits through
  // /api/det/submit. Its `grade` is unused today; the entry exists so the cap
  // counts and bounds it like everything else spoken.
  SPEAK_ABOUT_THE_PHOTO: {
    taskType: "SPEAK_ABOUT_THE_PHOTO",
    transcribeFeature: "speak-about-photo.transcribe",
    recordSeconds: 90,
    grade: async () => {
      throw new Error(
        "SPEAK_ABOUT_THE_PHOTO is graded by its own handler through /api/det/submit, " +
          "not by the speaking kernel.",
      );
    },
  },
};

export function speakingTaskFor(taskType: DetTaskType): SpeakingTask | undefined {
  return SPEAKING_TASKS[taskType];
}

/** Every task type that consumes a microphone — the set the paid gate and the
 *  daily cap apply to. */
export function speakingTaskTypes(): DetTaskType[] {
  return Object.keys(SPEAKING_TASKS) as DetTaskType[];
}

export function isSpeakingTask(taskType: DetTaskType): boolean {
  return taskType in SPEAKING_TASKS;
}
