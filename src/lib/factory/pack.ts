/**
 * RR-401 · the AlmiDET content factory: reads a factory pack (.md, written and checked by beta-g) into plain data.
 * Pure functions only (no network, no database), so every gate can be tested on fixtures.
 * The owner's rule: CC never rewrites content. These functions copy the text exactly; they only parse, count and check.
 * (Pattern: the AlmiPrep factory, RR-393. The DET pack has its own layout, so the parser is its own.)
 */

export const MODEL_ANSWER_LABEL = "AlmiDET model answer (estimate), not an official Duolingo English Test score";
export const TRADEMARK_LINE = "Duolingo and the Duolingo English Test are trademarks of Duolingo, Inc. AlmiDET is not affiliated with Duolingo.";

export type Level = "130+" | "110" | "85";
export const LEVELS: Level[] = ["130+", "110", "85"];

/** the pack item kinds, each mapped to the AlmiDET task type it belongs to */
export type Kind = "PHOTO" | "INTERACTIVE_WRITING" | "WRITING_SAMPLE" | "CONVERSATION" | "SPEAK_ABOUT_THE_PHOTO" | "READ_THEN_SPEAK" | "SPEAKING_SAMPLE";
export const TASK_TYPE: Record<Kind, string> = {
  PHOTO: "WRITE_ABOUT_THE_PHOTO",
  INTERACTIVE_WRITING: "INTERACTIVE_WRITING",
  WRITING_SAMPLE: "WRITING_SAMPLE",
  CONVERSATION: "INTERACTIVE_LISTENING",
  SPEAK_ABOUT_THE_PHOTO: "SPEAK_ABOUT_THE_PHOTO",
  READ_THEN_SPEAK: "READ_THEN_SPEAK",
  SPEAKING_SAMPLE: "SPEAKING_SAMPLE",
};

export type Part = { label: "Part 1" | "Part 2" | null; text: string };
export type PackAnswer = { level: Level; parts: Part[]; text: string; notes: string | null };
export type ScriptLine = { speaker: string; line: string };
export type PackItem = {
  /** the name the pack's word-count table uses ("Photo 1", "Interactive Writing 2", "Read, Then Speak (…)") */
  key: string;
  kind: Kind;
  /** the pack's own title for the item, or null when the pack gives none */
  packTitle: string | null;
  /** what the learner reads; for Interactive Writing, both parts */
  prompt: { text?: string; part1?: string; part2?: string };
  imageDescription: string | null;
  script: ScriptLine[];
  answers: PackAnswer[];
  /** one Notes paragraph shared by all levels (Photo, Conversation), or null when each level has its own */
  sharedNotes: string | null;
};
export type WordRow = { key: string; level: Level; total: number | null; part1: number | null; part2: number | null };
export type Pack = { file: string; title: string; packNo: number; author: string; date: string; items: PackItem[]; wordTable: WordRow[] };

/** a word = a run of characters between spaces (a hyphenated word or "don't" counts once; a lone dash does not count) */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function kindOf(key: string): Kind | null {
  if (/^Photo \d+$/.test(key)) return "PHOTO";
  if (/^Interactive Writing \d+$/.test(key)) return "INTERACTIVE_WRITING";
  if (/^Writing Sample \d+$/.test(key)) return "WRITING_SAMPLE";
  if (/^Conversation \d+$/.test(key)) return "CONVERSATION";
  if (/^Speak About the Photo\b/.test(key)) return "SPEAK_ABOUT_THE_PHOTO";
  if (/^Read, Then Speak\b/.test(key)) return "READ_THEN_SPEAK";
  if (/^Speaking Sample\b/.test(key)) return "SPEAKING_SAMPLE";
  return null;
}

/** "**130+ model:**", "**85 model summary (with mistakes on purpose):**", "**130+ model (about 140 words):**" */
const LEVEL_MARK = /^\*\*(130\+|110|85) model(?: summary)?(?: \([^)]*\))?:\*\*\s*/;
const NOTES_MARK = /^\*\*Notes:\*\*\s*/;
const PART_MARK = /^\*\*(Part [12]):\*\*\s*/;

/** paragraphs of a block, blank-line separated, trimmed, without rules (---) */
const paragraphs = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^---+$/.test(p));

export function parsePack(md: string, file: string): Pack {
  const src = md.replace(/\r\n/g, "\n");
  const title = /^title:\s*"([^"]+)"/m.exec(src)?.[1] ?? "";
  const subtitle = /^subtitle:\s*"([^"]+)"/m.exec(src)?.[1] ?? "";
  const packNo = Number(/Pack\s+(\d+)/.exec(title)?.[1] ?? NaN);
  const author = subtitle.split("·")[0].trim();
  const d = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(subtitle);
  const date = d ? `${d[3]}-${MONTHS[d[2].toLowerCase()]}-${d[1].padStart(2, "0")}` : "";
  if (!title || !Number.isFinite(packNo) || !author || !date) throw new Error(`${file}: front matter must give title (with "Pack N"), author and date`);

  // the word-count table is its own "## Word counts" section at the end
  const [body, tablePart = ""] = src.split(/^## Word counts\s*$/m);
  const wordTable = parseWordTable(tablePart);

  const items: PackItem[] = [];
  for (const block of body.split(/^# /m).slice(1)) {
    const head = block.split("\n", 1)[0].trim();
    if (/^Part [A-Z]\b/.test(head)) continue; // section headers ("Part A — Write About the Photo …")
    const dash = head.indexOf(" — ");
    const key = (dash >= 0 ? head.slice(0, dash) : head).trim();
    const kind = kindOf(key);
    if (!kind) throw new Error(`${file}: unknown item heading "${head}"`);
    const rest = dash >= 0 ? head.slice(dash + 3).trim() : "";
    const packTitle = kind === "SPEAK_ABOUT_THE_PHOTO" || !rest ? null : rest.replace(/\s*\(script for audio\)\s*$/, "").trim();
    items.push(parseItem(block.slice(block.indexOf("\n") + 1), key, kind, packTitle, file));
  }
  return { file, title, packNo, author, date, items, wordTable };
}

function parseItem(text: string, key: string, kind: Kind, packTitle: string | null, file: string): PackItem {
  const quoted = text.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "").trim()).filter(Boolean);
  const prompt: PackItem["prompt"] = {};
  let imageDescription: string | null = null;
  const script: ScriptLine[] = [];
  for (const q of quoted) {
    const photo = /^\*Photo(?: \([^)]*\))?:\s*(.+)\*$/.exec(q);
    if (photo) { imageDescription = photo[1].trim(); continue; }
    const part = /^\*\*Part ([12])(?: \(follow-up\))?:\*\*\s*(.+)$/.exec(q);
    if (part) { prompt[part[1] === "1" ? "part1" : "part2"] = part[2].trim(); continue; }
    const rts = /^\*\*Read the prompt, then speak about it:\*\*\s*\*(.+)\*$/.exec(q);
    if (rts) { prompt.text = rts[1].trim(); continue; }
    const line = /^\*\*([A-Z][A-Za-z ]*):\*\*\s*(.+)$/.exec(q);
    if (line && kind === "CONVERSATION") { script.push({ speaker: line[1], line: line[2].trim() }); continue; }
    const whole = /^\*\*(.+)\*\*$/.exec(q);
    if (whole) { prompt.text = whole[1].trim(); continue; }
    throw new Error(`${file} · ${key}: cannot read the quoted line "${q.slice(0, 60)}"`);
  }

  const answers: PackAnswer[] = [];
  let sharedNotes: string | null = null;
  // the body without the quoted prompt, cut at each level heading ("## 130+ model answer") when the pack uses them
  const bodyText = text.split("\n").filter((l) => !l.startsWith(">") && !/^\*Task:/.test(l)).join("\n");
  const sections = bodyText.split(/^## /m);
  if (sections.length > 1) {
    for (const sec of sections.slice(1)) {
      const lm = /^(130\+|110|85) model answer\s*$/m.exec(sec.split("\n", 1)[0]);
      if (!lm) continue;
      answers.push(readLevelSection(lm[1] as Level, sec.slice(sec.indexOf("\n") + 1)));
    }
  } else {
    // inline markers: "**130+ model:** text" … then one shared "**Notes:**"
    let cur: { level: Level | "notes"; buf: string[] } | null = null;
    const flush = () => {
      if (!cur) return;
      const t = paragraphs(cur.buf.join("\n")).join("\n\n");
      if (cur.level === "notes") sharedNotes = t;
      else answers.push({ level: cur.level, parts: [{ label: null, text: t }], text: t, notes: null });
    };
    for (const line of bodyText.split("\n")) {
      const lm = LEVEL_MARK.exec(line);
      const nm = NOTES_MARK.exec(line);
      if (lm) { flush(); cur = { level: lm[1] as Level, buf: [line.slice(lm[0].length)] }; continue; }
      if (nm) { flush(); cur = { level: "notes", buf: [line.slice(nm[0].length)] }; continue; }
      if (cur) cur.buf.push(line);
    }
    flush();
  }
  return { key, kind, packTitle, prompt, imageDescription, script, answers, sharedNotes };
}

function readLevelSection(level: Level, sec: string): PackAnswer {
  const [answerPart, notesPart] = sec.split(/^\*\*Notes:\*\*\s*/m);
  const notes = notesPart === undefined ? null : paragraphs(notesPart).join("\n\n");
  const paras = paragraphs(answerPart);
  if (paras.some((p) => PART_MARK.test(p))) {
    const parts: Part[] = [];
    for (const p of paras) {
      const m = PART_MARK.exec(p);
      if (m) parts.push({ label: m[1] as Part["label"], text: p.slice(m[0].length).trim() });
      else if (parts.length) parts[parts.length - 1].text += `\n\n${p}`;
    }
    return { level, parts, text: parts.map((x) => x.text).join("\n\n"), notes };
  }
  const t = paras.join("\n\n");
  return { level, parts: [{ label: null, text: t }], text: t, notes };
}

function parseWordTable(block: string): WordRow[] {
  const rows: WordRow[] = [];
  for (const line of block.split("\n")) {
    const m = /^\|\s*([^|]+?)\s*\|\s*(130\+|110|85)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const cell = m[3];
    const parts = /Part 1:\s*(\d+)\s*·\s*Part 2:\s*(\d+)/.exec(cell);
    rows.push({
      key: m[1],
      level: m[2] as Level,
      total: parts ? null : Number(cell),
      part1: parts ? Number(parts[1]) : null,
      part2: parts ? Number(parts[2]) : null,
    });
  }
  return rows;
}

/** the stable id of an item: pack number + the table key, never a database default */
export const itemId = (packNo: number, key: string) =>
  `det-p${packNo}-${key.replace(/\(.*\)/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
