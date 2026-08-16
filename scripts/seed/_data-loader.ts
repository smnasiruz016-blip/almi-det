// The shared content-file loader, used by every task type whose items are
// authored in a data file rather than inline.
//
// Interactive Listening needed this first; Interactive Writing and Writing
// Sample need exactly the same thing, so it is here once. What differs per type
// is only WHICH KEYS form the payload and which schema validates it — everything
// else (optional file, strict validation, level mapping, title dedupe) is
// identical and was worth extracting rather than copying twice more.
//
// THE DATA FILE IS OPTIONAL AT IMPORT TIME. When it is absent the bank is just
// the inline reference item — the content gates must not explode because an
// author has not dropped a file in yet. But absence is NOT silent: every type
// gets a check script that prints what was found and exits non-zero when the
// file is missing or the count is wrong. A loader that quietly yields zero extra
// items and lets a run report success is the silent no-op this codebase has been
// bitten by before.
//
// VALIDATION IS STRICT AND LOUD. Every item is parsed with the SAME schema the
// submit route uses, not a friendlier restatement, and an item that does not
// parse THROWS naming the field. Nothing is coerced, defaulted, or dropped: an
// item the loader cannot read is one nobody should be seeding.

import { createRequire } from "node:module";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";

/** Authors write EASY/MEDIUM/HARD or the enum spellings; both are accepted so a
 *  generator change cannot silently land every item in one difficulty pool. */
const DIFFICULTY: Record<string, "FOUNDATION" | "CORE" | "STRETCH"> = {
  EASY: "FOUNDATION",
  MEDIUM: "CORE",
  HARD: "STRETCH",
  FOUNDATION: "FOUNDATION",
  CORE: "CORE",
  STRETCH: "STRETCH",
};

export type DataSource = {
  dataFilePresent: boolean;
  /** Repo-relative path, for the check script's message. */
  dataFile: string;
  itemCount: number;
  /** Why the file was not loaded, when it was not. */
  note: string | null;
};

/**
 * Read a data module if it is there.
 *
 * SYNCHRONOUS, via require(). The seed modules are `.ts`, which tsx compiles to
 * CJS, where top-level `await` is a build error — and `ITEMS` is consumed
 * synchronously by scripts/seed/append.ts and by the gate seam. Node 22+ can
 * require() an ES module with no top-level await, which is what a data file is,
 * so this needs no rename and no async plumbing.
 *
 * Only a MISSING MODULE is tolerated. A file that exists and throws while
 * loading propagates: that is a broken file, not an absent one, and it must not
 * be mistaken for "no content yet".
 *
 * NOTE: require() caches by resolved path. One process reads a given data file
 * once — which is why the loader tests use one process per variant.
 */
function readDataModule(dir: string, file: string): { items: unknown[]; source: DataSource } {
  const base: DataSource = {
    dataFilePresent: false,
    dataFile: `scripts/seed/${file}`,
    itemCount: 0,
    note: null,
  };

  let mod: Record<string, unknown>;
  try {
    mod = createRequire(__filename)(join(dir, file)) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(msg)) {
      return { items: [], source: { ...base, note: "file not present" } };
    }
    throw new Error(`${base.dataFile} exists but could not be loaded: ${msg}`);
  }

  // Accept the two names authors actually use, in both export positions.
  const items = mod.default ?? mod.ITEMS ?? mod.SCENARIOS;
  if (!Array.isArray(items)) {
    throw new Error(
      `${base.dataFile} must default-export an array (or export ITEMS / SCENARIOS); ` +
        `got ${typeof items}.`,
    );
  }
  return { items, source: { ...base, dataFilePresent: true, itemCount: items.length } };
}

export type LoadSpec = {
  /** __dirname of the calling loader. */
  dir: string;
  file: string;
  taskType: string;
  /** The SUBMIT-ROUTE payload schema. Not a copy of it. */
  schema: z.ZodType;
  /** Top-level data keys that make up the payload, in payload order. */
  payloadKeys: string[];
  defaults: { prompt: string; guidanceNote: string };
  /** Titles already used by inline items, so a collision is caught here. */
  reservedTitles: string[];
  /** topicTag when the data carries no topic of its own. */
  topicFallback: string;
};

export type LoadResult = {
  items: Prisma.DetItemCreateManyInput[];
  source: DataSource;
};

/**
 * One authored item -> one DetItem row.
 *
 * The payload is ASSEMBLED FROM THE NAMED KEYS AND THEN VALIDATED — it is not
 * rebuilt field by field. Rebuilding would silently drop anything the generator
 * adds next, and the schema is what decides which fields are legitimate.
 */
function toItem(raw: unknown, index: number, spec: LoadSpec): Prisma.DetItemCreateManyInput {
  const where = `${spec.taskType} item[${index}]`;
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

  const payload: Record<string, unknown> = {};
  for (const k of spec.payloadKeys) payload[k] = s[k];

  const parsed = spec.schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `${where} ("${title}") does not match the ${spec.taskType} payload schema:\n` +
        parsed.error.issues
          .map((i) => `    ${i.path.join(".") || "(root)"} — ${i.message}`)
          .join("\n"),
    );
  }

  // topicTag drives gate:uniformity's topic-spread report. Prefer what the
  // author says; fall back to one honest bucket rather than inventing a topic
  // per item, which would make the spread report look richer than it is.
  const topicTag =
    typeof s.topicTag === "string" && s.topicTag.trim()
      ? s.topicTag.trim()
      : typeof s.topic === "string" && s.topic.trim()
        ? s.topic.trim()
        : spec.topicFallback;

  return {
    taskType: spec.taskType as Prisma.DetItemCreateManyInput["taskType"],
    title,
    prompt:
      typeof s.prompt === "string" && s.prompt.trim() && !spec.payloadKeys.includes("prompt")
        ? s.prompt.trim()
        : spec.defaults.prompt,
    difficulty,
    topicTag,
    guidanceNote:
      typeof s.guidanceNote === "string" && s.guidanceNote.trim()
        ? s.guidanceNote.trim()
        : spec.defaults.guidanceNote,
    payload: payload as unknown as Prisma.InputJsonValue,
  };
}

/**
 * Every authored item as a DetItem row, or [] when the data file is absent.
 * Throws on a file that exists and is wrong — including duplicate titles, which
 * scripts/seed/append.ts dedupes on, so a collision would silently drop an item
 * and leave the live bank smaller than the source with nothing saying so.
 */
export function loadAuthoredItems(spec: LoadSpec): LoadResult {
  const { items: raw, source } = readDataModule(spec.dir, spec.file);
  const items = raw.map((r, i) => toItem(r, i, spec));

  const seen = new Map<string, number>();
  for (const t of [...spec.reservedTitles, ...items.map((i) => i.title)]) {
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  const dupes = [...seen].filter(([, n]) => n > 1).map(([t, n]) => `"${t}" x${n}`);
  if (dupes.length) {
    throw new Error(
      `Duplicate ${spec.taskType} title(s): ${dupes.join(", ")}. ` +
        `scripts/seed/append.ts dedupes on (taskType, title), so one of each pair would never be ` +
        `written and the live bank would be smaller than the source.`,
    );
  }

  return { items, source };
}
