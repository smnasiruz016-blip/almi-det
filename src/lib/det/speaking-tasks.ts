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
import {
  readThenSpeakPayloadSchema,
  listenThenSpeakPayloadSchema,
  speakingSamplePayloadSchema,
  RTS_SPEAK_SECONDS,
  LTS_SPEAK_SECONDS,
  SS_SPEAK_SECONDS,
} from "@/lib/det/tasks/spoken-rubric";
import { evaluateSpokenResponse } from "@/lib/det/tasks/speaking-rater";
import {
  interactiveSpeakingPayloadSchema,
  isTranscripts,
} from "@/lib/det/tasks/interactive-speaking";
import { readStoredAnswers } from "@/lib/det/staged";

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

  // The three rubric-based types. Each transcribes (billed once, metered under
  // its own label) and then rates the TRANSCRIPT — never the audio, which the
  // rater has never seen. The `task` handed to the rater is what the taker
  // actually received: the printed prompt, or for Listen Then Speak the question
  // they HEARD, which is server-only everywhere else.
  READ_THEN_SPEAK: {
    taskType: "READ_THEN_SPEAK",
    transcribeFeature: "read-then-speak.transcribe",
    recordSeconds: RTS_SPEAK_SECONDS,
    grade: async ({ transcript, payload, userId }) => {
      const p = readThenSpeakPayloadSchema.parse(payload);
      const s = await evaluateSpokenResponse({
        feature: "read-then-speak.evaluate",
        reference: p.rubric.reference,
        task: p.prompt,
        context: "TYPE: Read Then Speak — the candidate read this prompt on screen and spoke for up to 90 seconds.",
        transcript,
        userId,
      });
      return { pointsEarned: s.pointsEarned, pointsMax: s.pointsMax, fraction: s.fraction, feedback: s.feedback, telemetry: s.telemetry };
    },
  },
  LISTEN_THEN_SPEAK: {
    taskType: "LISTEN_THEN_SPEAK",
    transcribeFeature: "listen-then-speak.transcribe",
    recordSeconds: LTS_SPEAK_SECONDS,
    grade: async ({ transcript, payload, userId }) => {
      const p = listenThenSpeakPayloadSchema.parse(payload);
      const s = await evaluateSpokenResponse({
        feature: "listen-then-speak.evaluate",
        reference: p.rubric.reference,
        task: p.question,
        context:
          "TYPE: Listen Then Speak — the candidate HEARD this question and never saw it written. " +
          "Judge the answer on its own terms; a mishearing is a listening outcome, not a language error.",
        transcript,
        userId,
      });
      return { pointsEarned: s.pointsEarned, pointsMax: s.pointsMax, fraction: s.fraction, feedback: s.feedback, telemetry: s.telemetry };
    },
  },
  SPEAKING_SAMPLE: {
    taskType: "SPEAKING_SAMPLE",
    transcribeFeature: "speaking-sample.transcribe",
    recordSeconds: SS_SPEAK_SECONDS,
    grade: async ({ transcript, payload, userId }) => {
      const p = speakingSamplePayloadSchema.parse(payload);
      const s = await evaluateSpokenResponse({
        feature: "speaking-sample.evaluate",
        reference: p.rubric.reference,
        task: p.prompt,
        context: `TYPE: Speaking Sample (${p.category}) — up to 3 minutes. In the official DET this sample is sent to institutions UNSCORED; this rating is practice feedback only.`,
        transcript,
        userId,
      });
      return { pointsEarned: s.pointsEarned, pointsMax: s.pointsMax, fraction: s.fraction, feedback: s.feedback, telemetry: s.telemetry };
    },
  },

  // ONE rating call for the whole interview. Rating each turn separately would
  // quadruple the rater spend for a worse read: what this type measures is how
  // someone SUSTAINS an exchange, which no single turn shows.
  //
  // `grade` receives the stored response rather than a transcript, because by
  // the time it runs every turn has already been transcribed and recorded — the
  // per-turn transcriptions are billed as they happen, this is the one call left.
  INTERACTIVE_SPEAKING: {
    taskType: "INTERACTIVE_SPEAKING",
    transcribeFeature: "interactive-speaking.transcribe",
    // Per TURN, not per interview — the composer stops each answer here.
    recordSeconds: 35,
    grade: async ({ transcript, payload, userId }) => {
      const p = interactiveSpeakingPayloadSchema.parse(payload);
      // `transcript` carries the stored answers as JSON; see the speaking route.
      const stored = JSON.parse(transcript || "{}") as Record<string, unknown>;
      const turns = isTranscripts(p, readStoredAnswers(stored).text);
      const joined = turns
        .map(
          (t, i) =>
            `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.transcript.trim() || "(silence)"}`,
        )
        .join("\n\n");
      const s = await evaluateSpokenResponse({
        feature: "interactive-speaking.evaluate",
        reference: p.rubric.reference,
        task: `A ${p.turns.length}-question spoken interview on "${p.topic}" (${p.register} register). Judge the whole exchange, not one answer.`,
        context:
          "TYPE: Interactive Speaking — the candidate HEARD each question and never saw it written, " +
          "and answered them one at a time without knowing what came next. Judge how the exchange is " +
          "sustained across turns; a mishearing is a listening outcome, not a language error.",
        transcript: joined,
        userId,
      });
      return { pointsEarned: s.pointsEarned, pointsMax: s.pointsMax, fraction: s.fraction, feedback: s.feedback, telemetry: s.telemetry };
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
