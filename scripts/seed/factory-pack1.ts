// RR-401 · the factory pack's READY items (src/content/factory/det-model-answers.json) as DetItem rows.
//
// Exported for two readers only:
//   - scripts/gates/_bank.mts: the content gates check these rows like every other item, so what the factory seeds is gated;
//   - scripts/factory/seed-det-pack.ts: the owner-run seed (dry run by default).
// NOT in scripts/seed/append.ts: the factory rows go in only through the factory seed, with FACTORY_WRITE=yes and --confirm.
// Image-pending and audio-pending items never become rows (src/lib/factory/seed-rows.ts).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { seedRows, type TypeDefaults } from "../../src/lib/factory/seed-rows";
import type { ModelData } from "../../src/lib/factory/import";
import { PROMPT as IW_PROMPT, GUIDANCE as IW_GUIDANCE } from "./interactive-writing";
import { PROMPT as WS_PROMPT, GUIDANCE as WS_GUIDANCE } from "./writing-sample";
import { PROMPT as RTS_PROMPT, GUIDANCE as RTS_GUIDANCE } from "./read-then-speak";
import { PROMPT as SS_PROMPT, GUIDANCE as SS_GUIDANCE } from "./speaking-sample";

export const DEFAULTS: TypeDefaults = {
  INTERACTIVE_WRITING: { prompt: IW_PROMPT, guidanceNote: IW_GUIDANCE },
  WRITING_SAMPLE: { prompt: WS_PROMPT, guidanceNote: WS_GUIDANCE },
  READ_THEN_SPEAK: { prompt: RTS_PROMPT, guidanceNote: RTS_GUIDANCE },
  SPEAKING_SAMPLE: { prompt: SS_PROMPT, guidanceNote: SS_GUIDANCE },
};

export const FACTORY_DATA: ModelData = JSON.parse(readFileSync(join(__dirname, "..", "..", "src", "content", "factory", "det-model-answers.json"), "utf8"));

export const ITEMS: Prisma.DetItemCreateManyInput[] = seedRows(FACTORY_DATA, DEFAULTS).map((r) => ({
  ...r,
  payload: r.payload as Prisma.InputJsonValue,
}));
