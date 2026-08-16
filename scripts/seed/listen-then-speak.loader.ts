// Loads Cowork's authored LISTEN_THEN_SPEAK items.
//
// Thin — the shared machinery is in _data-loader.ts. What is specific here is
// which top-level keys form the payload and which schema validates it.

import { listenThenSpeakPayloadSchema } from "../../src/lib/det/tasks/spoken-rubric";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type ListenThenSpeakSource = DataSource;

export function loadAuthoredListenThenSpeak(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "listen-then-speak.data.mjs",
    taskType: "LISTEN_THEN_SPEAK",
    schema: listenThenSpeakPayloadSchema,
    payloadKeys: ["question", "rubric"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "speaking",
  });
}
