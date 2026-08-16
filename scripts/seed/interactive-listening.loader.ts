// Loads Cowork's authored Interactive Listening conversations.
//
// Thin by design: everything that is not specific to this task type — the
// optional data file, strict schema validation, level mapping, title dedupe —
// lives in _data-loader.ts, shared with the two Writing types.
//
// A loader rather than twelve inline literals because the scenarios are
// generated and will be regenerated; hand-copying them into a seed file creates
// a second copy that drifts the first time a wording is fixed upstream.

import { interactiveListeningPayloadSchema } from "../../src/lib/det/tasks/interactive-listening";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type ILSource = DataSource;

export function loadAuthoredScenarios(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "interactive-listening.data.mjs",
    taskType: "INTERACTIVE_LISTENING",
    schema: interactiveListeningPayloadSchema,
    payloadKeys: ["scenario", "complete", "turns", "summarize"],
    defaults: { prompt: defaults.prompt, guidanceNote: defaults.guidanceNote },
    reservedTitles: defaults.reservedTitles,
    // The conversations carry no topic field of their own, so they share one
    // honest bucket rather than a per-item tag that would fake topic spread.
    topicFallback: "conversation",
  });
}
