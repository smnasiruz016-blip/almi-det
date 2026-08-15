// gate:cloze — the axes that only a fill-in-the-letters task has.
//
//   C1 REAL WORD     visiblePrefix + missingLetters must be a real English word.
//   C2 TYPABLE KEY   missingLetters is letters only, non-empty; ids unique.
//   C3 NO GIVEAWAY   the completed word must not appear un-blanked elsewhere in
//                    the same passage, nor in the item's own visible prose.
//   C4 CONTEXT       every blank needs real words around it — a gap with nothing
//                    to read is unanswerable however many letters are shown.
//   C5 RARITY        difficulty is WORD RARITY, not passage length. Median
//                    frequency rank of blanked words must RISE across
//                    FOUNDATION -> CORE -> STRETCH.
//   C6 DENSITY       >= 5 blanks per passage, and density must not fall as
//                    difficulty rises.
//
// Reported but not enforced: how many dictionary words fit each blank's
// prefix+length. That count cannot be a pass/fail — 16 of 20 ordinary words are
// ambiguous by form alone, and resolving the form FROM CONTEXT is the skill this
// task tests. It is surfaced so an author can see which gaps carry risk and key
// `alsoAccept` accordingly.

import { defineGate, DIFFICULTIES, type Bank, type Finding } from "./_bank.mjs";

const MIN_BLANKS = 5;
const TARGET_BLANKS = 6;
/** Median frequency rank must rise by at least this much per difficulty step,
 *  so "harder" cannot be satisfied by a trivial reshuffle. */
const MIN_RARITY_STEP = 400;
/** Reported-only: flag a blank whose form admits more alternatives than this. */
const AMBIGUITY_NOTE = 20;

type Blank = {
  kind: "blank";
  id: string;
  visiblePrefix: string;
  missingLetters: string;
  alsoAccept?: string[];
  suffix?: string;
};
type Text = { kind: "text"; text: string };
type Token = Blank | Text;

const isBlank = (t: Token): t is Blank => t.kind === "blank";
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export default defineGate("gate:cloze", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const items = bank.items.filter((i) => i.taskType === "READ_AND_COMPLETE");
  if (items.length === 0) {
    report.push("  no READ_AND_COMPLETE items authored yet — nothing to check");
    return { findings, report };
  }

  const wordsModule = await import("an-array-of-english-words");
  const DICT = new Set(
    ((wordsModule.default ?? wordsModule) as unknown as string[]).map((w) => w.toLowerCase()),
  );
  // Frequency-ranked list: index 0 is the most common word in English.
  const freqList = await loadFreq();
  const RANK = new Map(freqList.map((w, i) => [w, i + 1]));
  const RAREST = freqList.length + 1;
  const rarity = (w: string) => RANK.get(w.toLowerCase()) ?? RAREST;

  const notWord: string[] = [];
  const badKey: string[] = [];
  const giveaway: string[] = [];
  const noContext: string[] = [];
  const thin: string[] = [];
  const ambiguous: string[] = [];
  const byDiff = new Map<string, number[]>();
  const densityByDiff = new Map<string, number[]>();

  for (const it of items) {
    const passage = (it.payload.passage as Token[] | undefined) ?? [];
    const blanks = passage.filter(isBlank);
    const stem = [it.title, it.prompt, it.guidanceNote ?? ""].join(" ").toLowerCase();
    const plainText = passage
      .filter((t): t is Text => t.kind === "text")
      .map((t) => t.text.toLowerCase())
      .join(" ");

    // ---- C6 density ----
    if (blanks.length < MIN_BLANKS) {
      thin.push(`${it.title}: ${blanks.length} blank(s), floor is ${MIN_BLANKS}`);
    }
    densityByDiff.set(it.difficulty, [
      ...(densityByDiff.get(it.difficulty) ?? []),
      blanks.length,
    ]);

    const ids = blanks.map((b) => b.id);
    if (new Set(ids).size !== ids.length) badKey.push(`${it.title}: duplicate blank id`);

    for (const b of blanks) {
      const full = `${b.visiblePrefix}${b.missingLetters}`.toLowerCase();

      // ---- C2 typable key ----
      if (!/^[A-Za-z]+$/.test(b.missingLetters)) {
        badKey.push(`${it.title} / ${b.id}: missingLetters "${b.missingLetters}" is not letters-only`);
      }
      if (!b.visiblePrefix) badKey.push(`${it.title} / ${b.id}: empty visiblePrefix`);
      for (const alt of b.alsoAccept ?? []) {
        if (!/^[A-Za-z]+$/.test(alt)) {
          badKey.push(`${it.title} / ${b.id}: alsoAccept "${alt}" is not letters-only`);
        }
        if (!DICT.has(`${b.visiblePrefix}${alt}`.toLowerCase())) {
          notWord.push(`${it.title} / ${b.id}: alsoAccept forms "${b.visiblePrefix}${alt}", not an English word`);
        }
      }

      // ---- C1 real word ----
      if (!DICT.has(full)) {
        notWord.push(`${it.title} / ${b.id}: "${full}" is not in the English word list`);
      }

      // ---- C3 no giveaway ----
      const re = new RegExp(`\\b${full}\\b`);
      if (re.test(plainText)) {
        giveaway.push(`${it.title} / ${b.id}: "${full}" appears un-blanked in the same passage`);
      }
      if (re.test(stem)) {
        giveaway.push(`${it.title} / ${b.id}: "${full}" appears in the item's own title/prompt/guidance`);
      }

      // ---- rarity sample (C5) ----
      byDiff.set(it.difficulty, [...(byDiff.get(it.difficulty) ?? []), rarity(full)]);

      // ---- reported: form ambiguity ----
      const fits = countFits(DICT, b.visiblePrefix.toLowerCase(), b.missingLetters.length);
      if (fits > AMBIGUITY_NOTE && !(b.alsoAccept ?? []).length) {
        ambiguous.push(`${it.title} / ${b.id}: "${b.visiblePrefix}" + ${b.missingLetters.length} fits ${fits} words, no alsoAccept keyed`);
      }
    }

    // ---- C4 context ----
    passage.forEach((t, i) => {
      if (!isBlank(t)) return;
      const before = passage.slice(0, i).some((x) => x.kind === "text" && x.text.trim().length > 0);
      const after = passage.slice(i + 1).some((x) => x.kind === "text" && x.text.trim().length > 0);
      if (!before && !after) {
        noContext.push(`${it.title} / ${t.id}: no readable text before or after this gap`);
      }
    });
  }

  report.push(`  READ_AND_COMPLETE: ${items.length} passage(s)`);
  report.push(`    C1 completed word is real English : ${notWord.length === 0 ? "clean" : `${notWord.length} problem(s)`}`);
  report.push(`    C2 key typable + ids unique       : ${badKey.length === 0 ? "clean" : `${badKey.length} problem(s)`}`);
  report.push(`    C3 no un-blanked giveaway         : ${giveaway.length === 0 ? "clean" : `${giveaway.length} problem(s)`}`);
  report.push(`    C4 every gap has context          : ${noContext.length === 0 ? "clean" : `${noContext.length} problem(s)`}`);
  report.push(`    C6 >= ${MIN_BLANKS} blanks per passage      : ${thin.length === 0 ? "clean" : `${thin.length} thin passage(s)`}`);

  if (notWord.length) findings.push({ severity: "FAIL", code: "CLOZE-NOT-A-WORD", message: "A completion is not an English word.", items: notWord });
  if (badKey.length) findings.push({ severity: "FAIL", code: "CLOZE-KEY-UNTYPABLE", message: "A blank's key cannot be typed as keyed.", items: badKey });
  if (giveaway.length) findings.push({ severity: "FAIL", code: "CLOZE-GIVEAWAY", message: "The answer is readable elsewhere on the page.", items: giveaway });
  if (noContext.length) findings.push({ severity: "FAIL", code: "CLOZE-NO-CONTEXT", message: "A gap has no surrounding text, so context cannot resolve it.", items: noContext });
  if (thin.length) findings.push({ severity: "FAIL", code: "CLOZE-TOO-FEW-BLANKS", message: `Passages must carry at least ${MIN_BLANKS} blanks (target ~${TARGET_BLANKS}).`, items: thin });

  // ---- C5 rarity ladder ----
  report.push("");
  report.push(`  C5 difficulty by WORD RARITY (median frequency rank of blanked words; ${freqList.length} ranked words, absent = rarest)`);
  const medians: { d: string; m: number; n: number }[] = [];
  for (const d of DIFFICULTIES) {
    const xs = byDiff.get(d) ?? [];
    if (!xs.length) continue;
    const m = median(xs);
    medians.push({ d, m, n: xs.length });
    const dens = densityByDiff.get(d) ?? [];
    report.push(
      `    ${d.padEnd(11)} median rank ${String(m).padStart(6)}  over ${String(xs.length).padStart(3)} blanked word(s)` +
        `   blanks/passage ${dens.length ? (dens.reduce((a, b) => a + b, 0) / dens.length).toFixed(1) : "-"}`,
    );
  }
  for (let i = 1; i < medians.length; i++) {
    const prev = medians[i - 1];
    const cur = medians[i];
    if (cur.m < prev.m + MIN_RARITY_STEP) {
      findings.push({
        severity: "FAIL",
        code: "CLOZE-DIFFICULTY-NOT-RARITY",
        message:
          `${cur.d} blanked words are not meaningfully rarer than ${prev.d} (median rank ${cur.m} vs ${prev.m}; ` +
          `at least +${MIN_RARITY_STEP} required). Difficulty must come from vocabulary, not passage length.`,
      });
    }
  }

  if (ambiguous.length) {
    findings.push({
      severity: "WARN",
      code: "CLOZE-FORM-AMBIGUOUS",
      message:
        `A gap's prefix and length admit many words and no alternative is keyed. Not a failure — context ` +
        `normally forces one reading, and resolving it is the skill — but check the sentence really does, ` +
        `and key alsoAccept if another word fits.`,
      items: ambiguous,
    });
  }

  return { findings, report };
});

/** Count dictionary words matching prefix + exactly n more letters. */
function countFits(dict: Set<string>, prefix: string, n: number): number {
  let c = 0;
  const len = prefix.length + n;
  for (const w of dict) {
    if (w.length === len && w.startsWith(prefix)) c++;
  }
  return c;
}

async function loadFreq(): Promise<string[]> {
  // The package ships a plain newline-delimited resource file; read it directly
  // rather than through its loader, which is CJS-only.
  const { readFileSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const path = require.resolve("most-common-words-by-language/build/resources/english.txt");
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
