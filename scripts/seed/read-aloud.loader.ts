// Loads Cowork's authored Read Aloud sentences.
//
// Thin — the shared machinery is in _data-loader.ts. What is specific here is
// that the payload is a single key: the sentence itself.
//
// There is no inline reference item for this type. Every other type keeps one as
// a worked example of a shape someone has to get right; a Read Aloud payload is
// `{ text }`, so the data file IS the example and a twelfth-of-a-line reference
// would only be a duplicate title waiting to collide.

import { readAloudPayloadSchema } from "../../src/lib/det/tasks/read-aloud";
import { loadAuthoredItems, type DataSource, type LoadResult } from "./_data-loader";

export type ReadAloudSource = DataSource;

export function loadAuthoredReadAloud(defaults: {
  prompt: string;
  guidanceNote: string;
  reservedTitles: string[];
}): LoadResult {
  return loadAuthoredItems({
    dir: __dirname,
    file: "read-aloud.data.mjs",
    taskType: "READ_ALOUD",
    schema: readAloudPayloadSchema,
    payloadKeys: ["text"],
    defaults,
    reservedTitles: defaults.reservedTitles,
    topicFallback: "read-aloud",
  });
}
