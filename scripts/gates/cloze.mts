// gate:cloze — the axes that only a fill-in-the-letters task has.
//
// Covers BOTH cloze types, which share a payload shape and a grader and differ
// only in scope — a difference this gate is what enforces:
//   READ_AND_COMPLETE   passage scope, >= 5 blanks
//   FILL_IN_THE_BLANKS  sentence scope, EXACTLY 1 blank, one sentence only
//
// Scope changes what the checks have to be. With a paragraph, a loose gap is
// usually pinned down by the sentence before it, so form ambiguity is advisory.
// With one sentence and nothing else, there is no such rescue — so for
// FILL_IN_THE_BLANKS an unresolved ambiguous gap BLOCKS rather than warns.
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

const CLOZE_TYPES = ["READ_AND_COMPLETE", "FILL_IN_THE_BLANKS"];

/** Blanks required per item, by scope. */
const BLANK_RULE: Record<string, { min: number; max: number; label: string }> = {
  READ_AND_COMPLETE: { min: 5, max: Infinity, label: ">= 5" },
  FILL_IN_THE_BLANKS: { min: 1, max: 1, label: "exactly 1" },
};

/** Types that must be a single self-contained sentence, not a passage. */
const SENTENCE_SCOPE = new Set(["FILL_IN_THE_BLANKS"]);

const MIN_BLANKS = 5;
const TARGET_BLANKS = 6;

/** With only one sentence of context, a gap this ambiguous and with no keyed
 *  alternative is one the sentence probably cannot resolve — blocking, not
 *  advisory, for sentence-scope items. */
const SENTENCE_AMBIGUITY_FAIL = 12;
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

  const items = bank.items.filter((i) => CLOZE_TYPES.includes(i.taskType));
  if (items.length === 0) {
    report.push("  no cloze items authored yet — nothing to check");
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
  const notSentence: string[] = [];
  const ambiguous: string[] = [];
  const sentenceAmbiguous: string[] = [];
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

    // ---- C6 density, by scope ----
    const rule = BLANK_RULE[it.taskType] ?? { min: MIN_BLANKS, max: Infinity, label: `>= ${MIN_BLANKS}` };
    if (blanks.length < rule.min || blanks.length > rule.max) {
      thin.push(`${it.taskType} / ${it.title}: ${blanks.length} blank(s), rule is ${rule.label}`);
    }

    // ---- C7 sentence scope ----
    // Fill in the Blanks must be ONE self-contained sentence. A second sentence
    // turns it into a miniature passage — a different task with different
    // difficulty, sharing this one's name.
    if (SENTENCE_SCOPE.has(it.taskType)) {
      const full = passage
        .map((t) => (t.kind === "text" ? t.text : `${t.visiblePrefix}${t.missingLetters}${t.suffix ?? ""}`))
        .join(" ")
        .trim();
      const terminals = (full.match(/[.!?]/g) ?? []).length;
      const endsWithTerminal = /[.!?]['")\]]?$/.test(full);
      if (terminals !== 1 || !endsWithTerminal) {
        notSentence.push(
          `${it.title}: ${terminals} sentence-ending mark(s)${endsWithTerminal ? "" : ", and does not end with one"} — "${full.slice(0, 70)}"`,
        );
      }
    }
    const dk = `${it.taskType}|${it.difficulty}`;
    densityByDiff.set(dk, [...(densityByDiff.get(dk) ?? []), blanks.length]);

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
      const rk = `${it.taskType}|${it.difficulty}`;
      byDiff.set(rk, [...(byDiff.get(rk) ?? []), rarity(full)]);

      // ---- reported: form ambiguity ----
      const fits = countFits(DICT, b.visiblePrefix.toLowerCase(), b.missingLetters.length);
      const noAlt = !(b.alsoAccept ?? []).length;
      if (SENTENCE_SCOPE.has(it.taskType)) {
        if (fits > SENTENCE_AMBIGUITY_FAIL && noAlt) {
          sentenceAmbiguous.push(
            `${it.title} / ${b.id}: "${b.visiblePrefix}" + ${b.missingLetters.length} fits ${fits} words, and one sentence must resolve it alone`,
          );
        }
      } else if (fits > AMBIGUITY_NOTE && noAlt) {
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

  const byType = CLOZE_TYPES.filter((t) => items.some((i) => i.taskType === t));
  report.push(`  cloze items: ${items.length} across ${byType.join(", ")}`);
  report.push(`    C1 completed word is real English : ${notWord.length === 0 ? "clean" : `${notWord.length} problem(s)`}`);
  report.push(`    C2 key typable + ids unique       : ${badKey.length === 0 ? "clean" : `${badKey.length} problem(s)`}`);
  report.push(`    C3 no un-blanked giveaway         : ${giveaway.length === 0 ? "clean" : `${giveaway.length} problem(s)`}`);
  report.push(`    C4 every gap has context          : ${noContext.length === 0 ? "clean" : `${noContext.length} problem(s)`}`);
  report.push(`    C6 blanks per item (by scope)     : ${thin.length === 0 ? "clean" : `${thin.length} item(s) off-rule`}`);
  report.push(`    C7 sentence scope where required  : ${notSentence.length === 0 ? "clean" : `${notSentence.length} problem(s)`}`);

  if (notWord.length) findings.push({ severity: "FAIL", code: "CLOZE-NOT-A-WORD", message: "A completion is not an English word.", items: notWord });
  if (badKey.length) findings.push({ severity: "FAIL", code: "CLOZE-KEY-UNTYPABLE", message: "A blank's key cannot be typed as keyed.", items: badKey });
  if (giveaway.length) findings.push({ severity: "FAIL", code: "CLOZE-GIVEAWAY", message: "The answer is readable elsewhere on the page.", items: giveaway });
  if (noContext.length) findings.push({ severity: "FAIL", code: "CLOZE-NO-CONTEXT", message: "A gap has no surrounding text, so context cannot resolve it.", items: noContext });
  if (thin.length) findings.push({ severity: "FAIL", code: "CLOZE-BLANK-COUNT", message: `Blank count is wrong for the type's scope (passage cloze >= ${MIN_BLANKS}, target ~${TARGET_BLANKS}; sentence cloze exactly 1).`, items: thin });
  if (notSentence.length) findings.push({ severity: "FAIL", code: "CLOZE-NOT-ONE-SENTENCE", message: `Fill in the Blanks must be a single self-contained sentence. More than one sentence makes it a small passage — a different task wearing this one's name.`, items: notSentence });
  if (sentenceAmbiguous.length) findings.push({ severity: "FAIL", code: "CLOZE-SENTENCE-AMBIGUOUS", message: `A sentence-scope gap admits too many words and keys no alternative. With a passage, context narrows a loose gap; with one sentence there is nothing to fall back on — reveal more prefix, tighten the sentence, or key the alternative.`, items: sentenceAmbiguous });

  // ---- C5 rarity ladder ----
  report.push("");
  report.push(`  C5 difficulty by WORD RARITY, PER TYPE (${freqList.length} ranked words, absent = rarest)`);
  report.push(`     A blended ladder can hide a flat one: two types averaged together look`);
  report.push(`     graded while either alone may not be. Each type is checked on its own.`);

  for (const t of byType) {
    const medians: { d: string; m: number }[] = [];
    for (const d of DIFFICULTIES) {
      const xs = byDiff.get(`${t}|${d}`) ?? [];
      if (!xs.length) continue;
      const m = median(xs);
      medians.push({ d, m });
      const dens = densityByDiff.get(`${t}|${d}`) ?? [];
      report.push(
        `    ${t.padEnd(19)} ${d.padEnd(11)} median rank ${String(m).padStart(6)}  over ${String(xs.length).padStart(3)} blanked word(s)` +
          `   blanks/item ${dens.length ? (dens.reduce((a, b) => a + b, 0) / dens.length).toFixed(1) : "-"}`,
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
            `${t}: ${cur.d} blanked words are not meaningfully rarer than ${prev.d} (median rank ${cur.m} vs ${prev.m}; ` +
            `at least +${MIN_RARITY_STEP} required). Difficulty must come from vocabulary, not item length.`,
        });
      }
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
