// Loads Cowork's authored READ_THEN_SPEAK items.
//
// Thin — the shared machinery is in _data-loader.ts. What is specific here is
// which top-level keys form the payload and which schema validates it.

import { readThenSpeakPayloadSchema } from "../../src/lib/det/tasks/spoken-rubric";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type ReadThenSpeakSource = DataSource;

export function loadAuthoredReadThenSpeak(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "read-then-speak.data.mjs",
    taskType: "READ_THEN_SPEAK",
    schema: readThenSpeakPayloadSchema,
    payloadKeys: ["prompt", "rubric"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "speaking",
  });
}
