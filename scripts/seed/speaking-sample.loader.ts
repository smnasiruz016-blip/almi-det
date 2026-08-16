// Loads Cowork's authored SPEAKING_SAMPLE items.
//
// Thin — the shared machinery is in _data-loader.ts. What is specific here is
// which top-level keys form the payload and which schema validates it.

import { speakingSamplePayloadSchema } from "../../src/lib/det/tasks/spoken-rubric";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type SpeakingSampleSource = DataSource;

export function loadAuthoredSpeakingSample(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "speaking-sample.data.mjs",
    taskType: "SPEAKING_SAMPLE",
    schema: speakingSamplePayloadSchema,
    payloadKeys: ["category", "prompt", "rubric"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "speaking",
  });
}
