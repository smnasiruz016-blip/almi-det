// Loads Cowork's authored Writing Sample items.
//
// Thin — the shared machinery is in _data-loader.ts.
//
// NOTE ON `prompt`. This is the one type where the data's `prompt` is part of
// the PAYLOAD (the task the taker answers) rather than the DetItem instruction
// ("Read the prompt, then write your response."). The shared loader knows the
// difference by checking whether "prompt" is one of the payload keys, so the
// task prompt cannot end up in the instruction slot.

import { writingSamplePayloadSchema } from "../../src/lib/det/tasks/writing-sample";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type WSSource = DataSource;

export function loadAuthoredWritingSample(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "writing-sample.data.mjs",
    taskType: "WRITING_SAMPLE",
    schema: writingSamplePayloadSchema,
    payloadKeys: ["category", "topic", "prompt", "targetWords", "rubric"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "writing",
  });
}
