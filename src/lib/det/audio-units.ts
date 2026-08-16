// THE AUDIO MANIFEST — which clips an item needs, derived from its payload
// alone.
//
// One function, two callers, and that is the point:
//
//   scripts/generate-det-audio.mts  renders exactly these units and writes them
//                                   to DetItemAudio.
//   scripts/gates/il-audio-coverage.mts  asserts that every segment an item's
//                                   payload REFERENCES is one this function
//                                   would produce.
//
// Before this existed the manifest lived inside the generator, which needs a
// database, so no gate could see it. A payload could name `seg: "turn-9"` for a
// turn the generator would never render: the item would ship with a silent hole
// where a clip should be, and nothing before production would say so.
//
// Pure by construction — no database, no network, no Prisma types.

import {
  segLabelToNumber,
  isValidSegLabel,
  spokenScenario,
  interactiveListeningPayloadSchema,
} from "@/lib/det/tasks/interactive-listening";
import { LTS_QUESTION_SEG, LTS_QUESTION_LABEL } from "@/lib/det/tasks/spoken-rubric";

export type AudioUnit = {
  /** DetItemAudio.seg — the integer the table keys on. */
  seg: number;
  /** The label as authored, for reporting. Empty for types with no labels. */
  label: string;
  /** What the voice speaks. */
  text: string;
};

/**
 * Every audio unit an item needs, or [] for a task type with no audio.
 *
 * Returns [] rather than throwing on a payload that does not parse: the callers
 * report a bad payload through their own channels (the gate as a finding, the
 * generator as a skipped item), and a throw here would take down a whole run
 * over one malformed item.
 */
export function audioUnitsForItem(taskType: string, payload: unknown): AudioUnit[] {
  if (taskType === "LISTEN_AND_TYPE") {
    const p = (payload ?? {}) as { sentence?: string; audioScript?: string };
    const text = (p.audioScript ?? p.sentence ?? "").trim();
    return text ? [{ seg: 0, label: "sentence", text }] : [];
  }

  if (taskType === "INTERACTIVE_LISTENING") {
    const parsed = interactiveListeningPayloadSchema.safeParse(payload);
    if (!parsed.success) return [];
    const p = parsed.data;
    const units: AudioUnit[] = [];

    // An unrenderable label is SKIPPED, not thrown on. gate:il-audio-coverage
    // reports it as a finding and blocks the build; throwing here would take out
    // the gate that was about to name the problem, and would abort a whole audio
    // run over one bad item.
    const push = (label: string, text: string): void => {
      if (!text || !isValidSegLabel(label)) return;
      units.push({ seg: segLabelToNumber(label), label, text });
    };

    // Part A — the scenario clip.
    push(p.complete.seg, spokenScenario(p));

    // Part B — one clip per turn that HAS one. The opener has no audio by
    // design ("pick the best way to start"), so a null seg is not a hole.
    for (const t of p.turns) {
      if (t.seg === null) continue;
      push(t.seg, (t.line ?? "").trim());
    }

    return units;
  }

  if (taskType === "LISTEN_THEN_SPEAK") {
    // One clip per item: the question, spoken. Pre-rendered at deploy time in
    // OUR voice, exactly like the Interactive Listening segments — and for the
    // same reason it must exist before the type goes live, because the question
    // text is never projected, so an item with no clip is unanswerable rather
    // than merely quiet.
    const p = (payload ?? {}) as { question?: unknown };
    const text = typeof p.question === "string" ? p.question.trim() : "";
    return text ? [{ seg: LTS_QUESTION_SEG, label: LTS_QUESTION_LABEL, text }] : [];
  }

  return [];
}

/** Task types this manifest knows how to speak. */
export const AUDIO_TASK_TYPES = [
  "LISTEN_AND_TYPE",
  "INTERACTIVE_LISTENING",
  "LISTEN_THEN_SPEAK",
] as const;
