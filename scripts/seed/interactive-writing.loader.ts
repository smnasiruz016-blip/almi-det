// Loads Cowork's authored Interactive Writing items.
//
// Thin — the shared machinery is in _data-loader.ts. What is specific here is
// which top-level keys form the payload and which schema validates it.
//
// `topic` does double duty: it is part of the payload (the composer shows it)
// AND the item's topicTag, so gate:uniformity's topic-spread report reflects the
// real spread rather than one bucket.

import { interactiveWritingPayloadSchema } from "../../src/lib/det/tasks/interactive-writing";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type IWSource = DataSource;

export function loadAuthoredInteractiveWriting(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "interactive-writing.data.mjs",
    taskType: "INTERACTIVE_WRITING",
    schema: interactiveWritingPayloadSchema,
    payloadKeys: ["topic", "register", "part1", "part2", "rubric"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "writing",
  });
}
