// Loads Cowork's authored Interactive Listening scenarios and maps them into
// DetItem rows.
//
// WHY A LOADER RATHER THAN TWELVE INLINE LITERALS. The scenarios are generated
// and will be regenerated; hand-copying them into a seed file creates a second
// copy that drifts the first time a wording is fixed upstream. The data file is
// the source of truth and this module is the only thing that reads it.
//
// THE DATA FILE IS OPTIONAL AT IMPORT TIME. When it is absent the bank is just
// the reference conversation, exactly as before — the content gates must not
// explode because an author has not dropped a file in yet. But absence is NOT
// silent: `npm run seed:il-check` prints what was found, and IL_SOURCE records
// it for anything that wants to assert on it. A loader that quietly yields zero
// extra items and lets a run report success is the silent no-op this codebase
// has been bitten by before.
//
// VALIDATION IS STRICT AND LOUD. Every scenario is parsed with
// interactiveListeningPayloadSchema — the SAME schema the submit route uses, not
// a friendlier restatement of it — and a scenario that does not parse THROWS,
// naming the field. Nothing is coerced, defaulted, or dropped: a scenario the
// loader cannot read is a scenario nobody should be seeding.

import { createRequire } from "node:module";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { interactiveListeningPayloadSchema } from "../../src/lib/det/tasks/interactive-listening";

/** Cowork writes EASY/MEDIUM/HARD; DetDifficulty is FOUNDATION/CORE/STRETCH.
 *  Both spellings are accepted so a future generator change does not silently
 *  land every item in one difficulty pool. */
const DIFFICULTY: Record<string, "FOUNDATION" | "CORE" | "STRETCH"> = {
  EASY: "FOUNDATION",
  MEDIUM: "CORE",
  HARD: "STRETCH",
  FOUNDATION: "FOUNDATION",
  CORE: "CORE",
  STRETCH: "STRETCH",
};

export type ILSource = {
  dataFilePresent: boolean;
  /** Absolute-ish specifier we tried, for the check script's message. */
  dataFile: string;
  scenarioCount: number;
  /** Why the file was not loaded, when it was not. */
  note: string | null;
};

const DATA_FILE = "interactive-listening.data.mjs";

/**
 * Read the data module if it is there.
 *
 * SYNCHRONOUS, via require(). The seed modules are `.ts`, which tsx compiles to
 * CJS, where top-level `await` is a build error — and `ITEMS` is consumed
 * synchronously by scripts/seed/append.ts and by the gate seam. Node 22+ can
 * require() an ES module that has no top-level await, which is exactly what a
 * data file is, so this needs no rename and no async plumbing.
 *
 * Only a MISSING MODULE is tolerated. A data file that exists and throws while
 * loading propagates: that is a broken file, not an absent one, and it must not
 * be mistaken for "no content yet".
 */
function readDataModule(): { scenarios: unknown[]; source: ILSource } {
  const base: ILSource = {
    dataFilePresent: false,
    dataFile: `scripts/seed/${DATA_FILE}`,
    scenarioCount: 0,
    note: null,
  };
  const path = join(__dirname, DATA_FILE);

  let mod: Record<string, unknown>;
  try {
    mod = createRequire(__filename)(path) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(msg)) {
      return { scenarios: [], source: { ...base, note: "file not present" } };
    }
    throw new Error(`${base.dataFile} exists but could not be loaded: ${msg}`);
  }

  const scenarios = mod.default ?? mod.SCENARIOS;
  if (!Array.isArray(scenarios)) {
    throw new Error(
      `${base.dataFile} must default-export an array of scenarios (or export SCENARIOS); ` +
        `got ${typeof scenarios}.`,
    );
  }
  return {
    scenarios,
    source: { ...base, dataFilePresent: true, scenarioCount: scenarios.length },
  };
}

export type MappedItem = Prisma.DetItemCreateManyInput;

/**
 * One authored scenario -> one DetItem row.
 *
 * `payload` is passed through as authored and then validated. It is NOT rebuilt
 * field by field: rebuilding would silently drop anything the generator adds,
 * and the payload schema is what decides which fields are legitimate.
 */
export function scenarioToItem(
  raw: unknown,
  index: number,
  defaults: { prompt: string; guidanceNote: string },
): MappedItem {
  const where = `scenario[${index}]`;
  if (!raw || typeof raw !== "object") {
    throw new Error(`${where}: expected an object, got ${typeof raw}`);
  }
  const s = raw as Record<string, unknown>;

  const title = typeof s.title === "string" ? s.title.trim() : "";
  if (!title) throw new Error(`${where}: missing "title" — it is the seed dedupe key`);

  const levelRaw = typeof s.level === "string" ? s.level.trim().toUpperCase() : "";
  const difficulty = DIFFICULTY[levelRaw];
  if (!difficulty) {
    throw new Error(
      `${where} ("${title}"): level "${s.level}" is not one of ` +
        `${[...new Set(Object.keys(DIFFICULTY))].join(", ")}`,
    );
  }

  // The payload is whatever the generator wrote for these four keys, validated
  // by the runtime schema. A missing key surfaces as a schema error naming it.
  const payloadSource = {
    scenario: s.scenario,
    complete: s.complete,
    turns: s.turns,
    summarize: s.summarize,
  };
  const parsed = interactiveListeningPayloadSchema.safeParse(payloadSource);
  if (!parsed.success) {
    throw new Error(
      `${where} ("${title}") does not match the Interactive Listening payload schema:\n` +
        parsed.error.issues
          .map((i) => `    ${i.path.join(".") || "(root)"} — ${i.message}`)
          .join("\n"),
    );
  }

  // topicTag drives gate:uniformity's topic-spread report. Prefer what the
  // generator says; fall back to a single honest bucket rather than inventing a
  // topic per item, which would make the spread report look richer than it is.
  const topicTag =
    typeof s.topicTag === "string" && s.topicTag.trim()
      ? s.topicTag.trim()
      : typeof s.topic === "string" && s.topic.trim()
        ? s.topic.trim()
        : "conversation";

  return {
    taskType: "INTERACTIVE_LISTENING",
    title,
    prompt: typeof s.prompt === "string" && s.prompt.trim() ? s.prompt.trim() : defaults.prompt,
    difficulty,
    topicTag,
    guidanceNote:
      typeof s.guidanceNote === "string" && s.guidanceNote.trim()
        ? s.guidanceNote.trim()
        : defaults.guidanceNote,
    payload: payloadSource as unknown as Prisma.InputJsonValue,
  };
}

/**
 * Every authored scenario as a DetItem row, or [] when the data file is absent.
 * Throws on a data file that exists and is wrong — including duplicate titles,
 * which scripts/seed/append.ts dedupes on, so a collision would silently drop an
 * item and leave the live bank smaller than the source with nothing saying so.
 */
export function loadAuthoredScenarios(defaults: {
  prompt: string;
  guidanceNote: string;
  /** Titles already used by inline items, so a collision is caught here. */
  reservedTitles: string[];
}): { items: MappedItem[]; source: ILSource } {
  const { scenarios, source } = readDataModule();
  const items = scenarios.map((s, i) => scenarioToItem(s, i, defaults));

  const seen = new Map<string, number>();
  for (const t of [...defaults.reservedTitles, ...items.map((i) => i.title)]) {
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  const dupes = [...seen].filter(([, n]) => n > 1).map(([t, n]) => `"${t}" x${n}`);
  if (dupes.length) {
    throw new Error(
      `Duplicate Interactive Listening title(s): ${dupes.join(", ")}. ` +
        `scripts/seed/append.ts dedupes on (taskType, title), so one of each pair would never be ` +
        `written and the live bank would be smaller than the source.`,
    );
  }

  return { items, source };
}
