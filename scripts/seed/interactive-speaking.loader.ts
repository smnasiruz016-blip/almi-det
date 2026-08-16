// Loads Cowork's authored Interactive Speaking interviews.
//
// Thin — the shared machinery is in _data-loader.ts. What is specific here is
// which top-level keys form the payload and which schema validates it.

import { interactiveSpeakingPayloadSchema } from "../../src/lib/det/tasks/interactive-speaking";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type InteractiveSpeakingSource = DataSource;

export function loadAuthoredInteractiveSpeaking(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "interactive-speaking.data.mjs",
    taskType: "INTERACTIVE_SPEAKING",
    schema: interactiveSpeakingPayloadSchema,
    payloadKeys: ["topic", "register", "turns", "rubric"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "speaking",
  });
}
