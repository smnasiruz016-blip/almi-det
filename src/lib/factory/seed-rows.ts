/**
 * RR-401 · the factory items as AlmiDET DetItem rows, and what the seed would do. Pure (no database): tested without one.
 *
 * Only items with status "ready" become rows. An image-pending or audio-pending item NEVER becomes a row, so it can never be shown
 * to a learner without its image or its audio. Each payload is validated with the SAME schema the submit route uses.
 *
 * Every row uses the task type's existing columns and enum values: no new type, no schema change.
 */
import { interactiveWritingPayloadSchema } from "../det/tasks/interactive-writing";
import { writingSamplePayloadSchema } from "../det/tasks/writing-sample";
import { readThenSpeakPayloadSchema, speakingSamplePayloadSchema } from "../det/tasks/spoken-rubric";
import type { ModelData, ModelItem } from "./import";

/** the trait lists the authored data files use, per type (scripts/seed/*.data.mjs) */
const WRITING_TRAITS = ["Task response", "Coherence & organisation", "Vocabulary range", "Grammatical accuracy"];
const SPEAKING_TRAITS = ["Task relevance & development", "Fluency & coherence", "Vocabulary range", "Grammatical accuracy"];

/** the instruction and coaching line each type already uses (exported from its seed file) */
export type TypeDefaults = Record<"INTERACTIVE_WRITING" | "WRITING_SAMPLE" | "READ_THEN_SPEAK" | "SPEAKING_SAMPLE", { prompt: string; guidanceNote: string }>;

export type SeedRow = {
  taskType: "INTERACTIVE_WRITING" | "WRITING_SAMPLE" | "READ_THEN_SPEAK" | "SPEAKING_SAMPLE";
  title: string;
  prompt: string;
  difficulty: "CORE";
  topicTag: string;
  guidanceNote: string;
  payload: Record<string, unknown>;
};

/** the rater's server-only reference: beta-g's own notes on the 130+ model, markdown marks removed (words unchanged) */
export const referenceOf = (it: ModelItem) => {
  const top = it.answers.find((a) => a.level === "130+");
  const notes = top?.notes ?? it.sharedNotes;
  if (!notes) throw new Error(`${it.id}: no 130+ notes to use as the rater reference`);
  return notes.replace(/\*/g, "").trim();
};

export function seedRowFor(it: ModelItem, d: TypeDefaults): SeedRow {
  if (it.status !== "ready") throw new Error(`${it.id} is ${it.status}: a pending item is never seeded`);
  const reference = referenceOf(it);
  // the pack gives no difficulty; every factory item goes in the middle pool, CORE
  const base = { title: it.title, difficulty: "CORE" as const, topicTag: it.title };
  switch (it.taskType) {
    case "INTERACTIVE_WRITING": {
      const payload = { topic: it.title, register: "general", part1: { prompt: it.prompt.part1, minWords: 40 }, part2: { prompt: it.prompt.part2, minWords: 25 }, rubric: { traits: WRITING_TRAITS, reference } };
      interactiveWritingPayloadSchema.parse(payload);
      return { ...base, taskType: "INTERACTIVE_WRITING", prompt: d.INTERACTIVE_WRITING.prompt, guidanceNote: d.INTERACTIVE_WRITING.guidanceNote, payload };
    }
    case "WRITING_SAMPLE": {
      const payload = { category: "academic", topic: it.title, prompt: it.prompt.text, targetWords: "100–130+", rubric: { traits: WRITING_TRAITS, reference } };
      writingSamplePayloadSchema.parse(payload);
      return { ...base, taskType: "WRITING_SAMPLE", prompt: d.WRITING_SAMPLE.prompt, guidanceNote: d.WRITING_SAMPLE.guidanceNote, payload };
    }
    case "READ_THEN_SPEAK": {
      const payload = { prompt: it.prompt.text, rubric: { traits: SPEAKING_TRAITS, reference } };
      readThenSpeakPayloadSchema.parse(payload);
      return { ...base, taskType: "READ_THEN_SPEAK", prompt: d.READ_THEN_SPEAK.prompt, guidanceNote: d.READ_THEN_SPEAK.guidanceNote, payload };
    }
    case "SPEAKING_SAMPLE": {
      const payload = { category: "academic", prompt: it.prompt.text, rubric: { traits: SPEAKING_TRAITS, reference } };
      speakingSamplePayloadSchema.parse(payload);
      return { ...base, taskType: "SPEAKING_SAMPLE", prompt: d.SPEAKING_SAMPLE.prompt, guidanceNote: d.SPEAKING_SAMPLE.guidanceNote, payload };
    }
    default:
      throw new Error(`${it.id}: task type ${it.taskType} has no factory row (it should be pending)`);
  }
}

export const seedRows = (data: ModelData, d: TypeDefaults) => data.items.filter((i) => i.status === "ready").map((i) => seedRowFor(i, d));

/** the seed writes only with BOTH --confirm AND FACTORY_WRITE=yes; anything else is a dry run */
export const writeAllowed = (argv: string[], env: Record<string, string | undefined>) => argv.includes("--confirm") && env.FACTORY_WRITE === "yes";

/** the two database calls the seed makes, so the seed is tested against a fake with no database */
export type SeedDb = {
  findMany: (taskTypes: string[]) => Promise<LiveRow[]>;
  createMany: (rows: SeedRow[]) => Promise<number>;
};

export async function runSeed(db: SeedDb, rows: SeedRow[], write: boolean) {
  const live = await db.findMany([...new Set(rows.map((r) => r.taskType))]);
  const plan = planSeed(rows, live);
  const written = write && plan.create.length ? await db.createMany(plan.create) : 0;
  return { plan, written, dryRun: !write };
}

/** a DetItem row as the database holds it */
export type LiveRow = { taskType: string; title: string; prompt: string; difficulty: string; topicTag: string; guidanceNote: string | null; payload: unknown };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const textOf = (p: unknown) => {
  const x = (p ?? {}) as { prompt?: unknown; part1?: { prompt?: unknown }; part2?: { prompt?: unknown } };
  return [x.prompt, x.part1?.prompt, x.part2?.prompt].filter((v): v is string => typeof v === "string").join("\n");
};
/** key order does not matter for "the same payload" */
const canon = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);

/**
 * The seed keys items by (taskType, title), like scripts/seed/append.ts:
 *   - not there: create
 *   - there and equal: left alone (re-running changes nothing)
 *   - there but different: listed, NOT changed (a corrected pack needs the owner's word)
 *   - the same prompt live under another title: skipped (no duplicate task)
 * Nothing is ever deleted or deactivated.
 */
export function planSeed(rows: SeedRow[], live: LiveRow[]) {
  const create: SeedRow[] = [], same: string[] = [], differs: string[] = [], duplicate: string[] = [];
  for (const r of rows) {
    const l = live.find((x) => x.taskType === r.taskType && x.title === r.title);
    if (l) {
      const eq = l.prompt === r.prompt && l.difficulty === r.difficulty && l.topicTag === r.topicTag && l.guidanceNote === r.guidanceNote && canon(l.payload) === canon(r.payload);
      if (eq) same.push(`${r.taskType} "${r.title}"`);
      else differs.push(`${r.taskType} "${r.title}": the live row is not the same as the pack`);
      continue;
    }
    const twin = live.find((x) => x.taskType === r.taskType && norm(textOf(x.payload)) === norm(textOf(r.payload)));
    if (twin) { duplicate.push(`${r.taskType} "${r.title}": the same prompt is already live as "${twin.title}"`); continue; }
    create.push(r);
  }
  return { create, same, differs, duplicate };
}
