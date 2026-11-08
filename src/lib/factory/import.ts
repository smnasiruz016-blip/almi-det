/**
 * RR-401 · the importer core: packs + LanguageTool results → AlmiDET's model-answer data + the gate report. Pure and deterministic
 * (no clock, no randomness, sorted output), so re-importing the same packs gives byte-identical data: idempotent by construction.
 * (Pattern: AlmiPrep RR-393.)
 */
import { MODEL_ANSWER_LABEL, TASK_TYPE, TRADEMARK_LINE, countWords, itemId, type Kind, type Level, type Pack, type PackItem, type Part, type ScriptLine } from "./pack";
import { blockingFindings, hintCount, lowLevelNotesProblem, type GateFinding, type LtMatch } from "./grammar-gate";

export type Lang = "en-US";
export type Lt = (text: string, lang: Lang) => LtMatch[];

/** what LanguageTool reads for a note (the stored note keeps its markdown): **bold** loses its marks; an *italic* is a quoted learner
 *  mistake or a cited phrase, so it is read inside quotes and is exempt in the same way. */
export const plainNote = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "“$1”").replace(/\*/g, "");

/**
 * The pack gives no title for these items. CC's titles, taken from the item's own words; confirmed by beta-g (RR-401 round 2 decisions).
 * The pack's text is not changed; a title is only the label the bank and the learner see.
 */
export const CC_TITLES: Record<string, string> = {
  "Read, Then Speak": "A skill you would like to learn",
  "Speaking Sample": "A few close friends",
  "Speak About the Photo": "A science lab",
};

export type Status = "ready" | "image-pending" | "audio-pending";
export const PENDING_REASON: Partial<Record<Kind, { status: Status; reason: string }>> = {
  PHOTO: { status: "image-pending", reason: "AlmiDET shows a real photo for this task and the pack gives only a description of it. Hidden until an image exists." },
  SPEAK_ABOUT_THE_PHOTO: { status: "image-pending", reason: "Uses the pack's Photo 3 (the science lab), which has no image yet. Hidden until an image exists." },
  CONVERSATION: {
    status: "audio-pending",
    reason:
      "AlmiDET has no free Edge-voice audio pipeline: its conversation clips are made by a paid text-to-speech call (one voice), which RR-401 ($0) may not use. " +
      "Also, an Interactive Listening item needs Listen and Complete / Listen and Respond turns, and the pack gives only the script and the summaries. Hidden until audio exists.",
  },
};

export type ModelAnswer = { level: Level; parts: Part[]; text: string; wordCount: number; partWords: number[] | null; notes: string | null; withMistakes: boolean };
export type ModelItem = {
  id: string;
  packNo: number;
  key: string;
  kind: Kind;
  taskType: string;
  title: string;
  titleFrom: "pack" | "cc";
  status: Status;
  pendingReason: string | null;
  prompt: PackItem["prompt"];
  imageDescription: string | null;
  script: ScriptLine[];
  sharedNotes: string | null;
  provenance: { author: string; date: string; file: string };
  answers: ModelAnswer[];
};
export type ModelData = { schema: 1; label: string; trademark: string; items: ModelItem[] };

export type Blocked = { where: string; reasons: string[]; findings: GateFinding[] };
export type ImportResult = { data: ModelData; blocked: Blocked[]; hints: number; checkedTexts: number; skippedDuplicates: string[] };

/** an item already in the AlmiDET bank (from the seed sources) */
export type Existing = { taskType: string; title: string; text: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** the text the learner reads for an item: the prompt, or both parts; used for the duplicate check */
export const promptTextOf = (p: PackItem["prompt"]) => [p.text, p.part1, p.part2].filter(Boolean).join("\n");

export function importPacks(packs: Pack[], lt: Lt, existing: Existing[] = []): ImportResult {
  const blocked: Blocked[] = [];
  const skippedDuplicates: string[] = [];
  const out: ModelItem[] = [];
  const seen = new Set<string>();
  let hints = 0, checkedTexts = 0;
  const gate = (text: string, quotesExempt = false) => {
    checkedTexts++;
    const us = lt(text, "en-US");
    hints += hintCount(us);
    return blockingFindings(text, us, { quotesExempt });
  };

  for (const pack of packs) {
    for (const it of pack.items) {
      const id = itemId(pack.packNo, it.key);
      const where = `${pack.file} · ${it.key}`;
      if (seen.has(id)) throw new Error(`${where}: id ${id} appears twice across the packs`);
      seen.add(id);
      const taskType = TASK_TYPE[it.kind];
      const ccKey = Object.keys(CC_TITLES).find((k) => it.key.startsWith(k));
      const title = it.packTitle ?? (ccKey ? CC_TITLES[ccKey] : null);
      if (!title) throw new Error(`${where}: no title in the pack and none in CC_TITLES`);

      const reasons: string[] = [];
      const findings: GateFinding[] = [];
      const check = (label: string, text: string, quotesExempt = false) => {
        const f = gate(text, quotesExempt);
        if (f.length) { reasons.push(`${label}: grammar or spelling`); findings.push(...f.map((x) => ({ ...x, snippet: `[${label}] ${x.snippet}` }))); }
      };

      // a title already in the bank: the same task again is skipped; a different task under that title cannot be told apart
      const twin = existing.find((e) => e.taskType === taskType && e.title === title);
      const text = promptTextOf(it.prompt);
      if (twin && norm(twin.text) === norm(text)) { skippedDuplicates.push(`${where}: the same item is already in AlmiDET as "${twin.title}"`); continue; }
      if (twin) reasons.push(`title "${title}" is already used by a different ${taskType} item in AlmiDET (the seed and the bank key items by type + title), so this one cannot be added under it: beta-g to give it another title`);
      const sameText = text && existing.find((e) => e.taskType === taskType && norm(e.text) === norm(text));
      if (sameText) { skippedDuplicates.push(`${where}: the same prompt is already in AlmiDET as "${sameText.title}"`); continue; }

      // the prompt the learner reads, and the script the learner hears
      if (it.kind === "INTERACTIVE_WRITING" && (!it.prompt.part1 || !it.prompt.part2)) reasons.push("Part 1 or Part 2 prompt missing");
      if (["WRITING_SAMPLE", "READ_THEN_SPEAK", "SPEAKING_SAMPLE"].includes(it.kind) && !it.prompt.text) reasons.push("prompt missing");
      if ((it.kind === "PHOTO") && !it.imageDescription) reasons.push("image description missing");
      if (it.kind === "CONVERSATION" && it.script.length < 2) reasons.push("script missing");
      for (const [k, v] of Object.entries(it.prompt)) if (v) check(`prompt ${k}`, v);
      if (it.script.length) check("script", it.script.map((s) => s.line).join("\n"));

      const answers: ModelAnswer[] = [];
      const expectedLevels: Level[] = ["SPEAK_ABOUT_THE_PHOTO", "READ_THEN_SPEAK", "SPEAKING_SAMPLE"].includes(it.kind) ? ["130+"] : ["130+", "110", "85"];
      for (const lv of expectedLevels) if (!it.answers.some((a) => a.level === lv)) reasons.push(`${lv} model answer missing`);
      for (const a of it.answers) {
        const w = `${a.level}`;
        const words = countWords(a.text);
        const partWords = a.parts.length > 1 ? a.parts.map((p) => countWords(p.text)) : null;
        const row = pack.wordTable.find((r) => r.key === it.key && r.level === a.level);
        if (!row) reasons.push(`${w}: no row in the pack's word-count table`);
        else if (row.total !== null ? row.total !== words || partWords !== null : partWords === null || row.part1 !== partWords[0] || row.part2 !== partWords[1])
          reasons.push(`${w}: word count differs from the pack's table: counted ${partWords ? `Part 1: ${partWords[0]} · Part 2: ${partWords[1]}` : words}, table ${row.total ?? `Part 1: ${row.part1} · Part 2: ${row.part2}`}`);
        const notes = a.notes ?? it.sharedNotes;
        if (a.level === "85") {
          const prob = lowLevelNotesProblem(notes);
          if (prob) reasons.push(`${w}: ${prob}`);
        } else {
          if (!notes) reasons.push(`${w}: notes missing`);
          check(`${w} answer`, a.text);
        }
        if (a.notes) check(`${w} notes`, plainNote(a.notes), true);
        answers.push({ level: a.level, parts: a.parts, text: a.text, wordCount: words, partWords, notes: a.notes, withMistakes: a.level === "85" });
      }
      if (it.sharedNotes) check("notes", plainNote(it.sharedNotes), true);
      if (!it.answers.length && !reasons.length) reasons.push("no model answer");

      if (reasons.length) { blocked.push({ where, reasons, findings }); continue; }
      const pend = PENDING_REASON[it.kind];
      answers.sort((x, y) => Number.parseInt(y.level) - Number.parseInt(x.level));
      out.push({
        id, packNo: pack.packNo, key: it.key, kind: it.kind, taskType, title, titleFrom: it.packTitle ? "pack" : "cc",
        status: pend?.status ?? "ready", pendingReason: pend?.reason ?? null,
        prompt: it.prompt, imageDescription: it.imageDescription, script: it.script, sharedNotes: it.sharedNotes,
        provenance: { author: pack.author, date: pack.date, file: pack.file }, answers,
      });
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return { data: { schema: 1, label: MODEL_ANSWER_LABEL, trademark: TRADEMARK_LINE, items: out }, blocked, hints, checkedTexts, skippedDuplicates };
}

/** merge freshly imported items into the data already in the repo: same id → replaced by the new import, others kept */
export function mergeData(prev: ModelData | null, next: ModelData): ModelData {
  const byId = new Map((prev?.items ?? []).map((p) => [p.id, p]));
  for (const p of next.items) byId.set(p.id, p);
  return { ...next, items: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
