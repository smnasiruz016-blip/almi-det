// gate:reading-set — the axes a multiple-choice reading set brings with it.
//
//   IR1 WELL-FORMED   >= 3 distinct options, exactly one correct, key resolves
//   IR2 LENGTH TELL   the correct option must not be the longest one. "Pick the
//                     longest answer" is the oldest MCQ heuristic there is, and
//                     it needs no English at all.
//   IR3 POSITION      the correct option's position must not concentrate — the
//                     same blindness gate:degame's D2 exists for, one task type
//                     over.
//   IR4 STEM OVERLAP  the correct option must not share distinctive words with
//                     the stem that the distractors lack. Word-matching is a
//                     test-taking trick, not comprehension.
//   IR5 SPAN COVER    Highlight the Answer requires the passage to be spanned
//                     UNIFORMLY. If only the sentences a question targets were
//                     selectable, the markup would answer the question. >= 3
//                     spans, and the keyed span must be one of them.
//   IR6 REACHABLE     ids unique, every key resolves, every question gradable.
//   IR7 COVERAGE      all five sub-kinds appear somewhere in the bank, and
//                     difficulty rises by passage vocabulary RARITY, not length.
//   IR8 COPYABLE KEY  the passage is on screen beside the stem, so for a
//                     sub-kind whose answer is not meant to come from the
//                     passage, a key that appears in it is findable rather than
//                     known. Highlight and Complete the Passage are exempt.

import { defineGate, DIFFICULTIES, type Bank, type Finding } from "./_bank.mjs";

const MIN_OPTIONS = 3;
const MIN_SPANS = 3;
/** Fail when the correct option is the longest this often. Chance for 4 options
 *  is 25%; 45% leaves room for honest variation without letting the tell live. */
const LENGTH_TELL_FAIL = 0.45;
/** Fail when one position holds this share of the correct answers. */
const POSITION_FAIL = 0.5;
/** Median frequency rank must rise by at least this much per difficulty step. */
const MIN_RARITY_STEP = 400;
/** IR8: sub-kinds whose answer is NOT meant to come from the passage. For these
 *  the key must not appear in the passage at all — the passage is on screen. */
const COPYABLE_KINDS = new Set(["COMPLETE_THE_SENTENCES"]);

const ALL_KINDS = [
  "COMPLETE_THE_SENTENCES",
  "COMPLETE_THE_PASSAGE",
  "HIGHLIGHT_THE_ANSWER",
  "IDENTIFY_THE_IDEA",
  "TITLE_THE_PASSAGE",
];

type Option = { id: string; text: string };
type Question = {
  kind: string;
  id: string;
  stem: string;
  options?: Option[];
  correctId?: string;
  correctSpanId?: string;
};
type Span = { id: string; text: string };

const words = (s: string): string[] =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 4);

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export default defineGate("gate:reading-set", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const items = bank.items.filter((i) => i.taskType === "INTERACTIVE_READING");
  if (items.length === 0) {
    report.push("  no INTERACTIVE_READING items authored yet — nothing to check");
    return { findings, report };
  }

  const { readFileSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const freq = readFileSync(
    req.resolve("most-common-words-by-language/build/resources/english.txt"),
    "utf8",
  )
    .split(String.fromCharCode(10))
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const RANK = new Map(freq.map((w, i) => [w, i + 1]));
  const RAREST = freq.length + 1;

  const malformed: string[] = [];
  const lengthTell: string[] = [];
  const stemOverlap: string[] = [];
  const copyable: string[] = [];
  const spanProblem: string[] = [];
  const unreachable: string[] = [];

  const kindsSeen = new Set<string>();
  const positions: number[] = [];
  let longestCorrect = 0;
  let selectCount = 0;
  const rarityByDiff = new Map<string, number[]>();

  for (const it of items) {
    const passage = (it.payload.passage as { spans?: Span[] } | undefined) ?? {};
    const spans = passage.spans ?? [];
    const questions = (it.payload.questions as Question[] | undefined) ?? [];

    // ---- IR5 span cover ----
    if (spans.length < MIN_SPANS) {
      spanProblem.push(`${it.title}: ${spans.length} span(s), floor is ${MIN_SPANS}`);
    }
    const spanIds = spans.map((s) => s.id);
    if (new Set(spanIds).size !== spanIds.length) {
      spanProblem.push(`${it.title}: duplicate span id`);
    }
    if (spans.some((s) => !s.text || !s.text.trim())) {
      spanProblem.push(`${it.title}: a span carries no text — an empty selectable region`);
    }

    // Every word the passage puts on screen, for the IR8 copyable-key check.
    const passageTokens = new Set(
      spans
        .map((sp) => sp.text.toLowerCase())
        .join(" ")
        .replace(/[^a-z]+/g, " ")
        .split(" ")
        .filter(Boolean),
    );

    // ---- passage rarity (IR7) ----
    const passageWords = words(spans.map((s) => s.text).join(" "));
    const ranks = passageWords.map((w) => RANK.get(w) ?? RAREST);
    rarityByDiff.set(it.difficulty, [...(rarityByDiff.get(it.difficulty) ?? []), ...ranks]);

    const qIds = questions.map((q) => q.id);
    if (new Set(qIds).size !== qIds.length) unreachable.push(`${it.title}: duplicate question id`);

    for (const q of questions) {
      kindsSeen.add(q.kind);
      if (!ALL_KINDS.includes(q.kind)) {
        unreachable.push(`${it.title} / ${q.id}: unknown sub-kind "${q.kind}"`);
        continue;
      }

      if (q.kind === "HIGHLIGHT_THE_ANSWER") {
        // ---- IR6 reachability for highlight ----
        if (!q.correctSpanId || !spanIds.includes(q.correctSpanId)) {
          unreachable.push(`${it.title} / ${q.id}: correctSpanId does not name a span in this passage`);
        }
        continue;
      }

      // ---- IR1 well-formed ----
      const options = q.options ?? [];
      if (options.length < MIN_OPTIONS) {
        malformed.push(`${it.title} / ${q.id}: ${options.length} option(s), floor is ${MIN_OPTIONS}`);
      }
      const oIds = options.map((o) => o.id);
      const oTexts = options.map((o) => o.text.trim().toLowerCase());
      if (new Set(oIds).size !== oIds.length) malformed.push(`${it.title} / ${q.id}: duplicate option id`);
      if (new Set(oTexts).size !== oTexts.length) malformed.push(`${it.title} / ${q.id}: duplicate option text`);
      const correct = options.find((o) => o.id === q.correctId);
      if (!correct) {
        unreachable.push(`${it.title} / ${q.id}: correctId does not name one of its options`);
        continue;
      }

      selectCount++;
      positions.push(options.findIndex((o) => o.id === correct.id));

      // ---- IR2 length tell ----
      const maxLen = Math.max(...options.map((o) => o.text.length));
      if (correct.text.length === maxLen && options.some((o) => o.text.length < maxLen)) {
        longestCorrect++;
        lengthTell.push(`${it.title} / ${q.id}: correct option is the longest (${correct.text.length} chars)`);
      }

      // ---- IR4 stem overlap ----
      const stemWords = new Set(words(q.stem));
      const overlap = (t: string) => words(t).filter((w) => stemWords.has(w)).length;
      const correctOverlap = overlap(correct.text);
      const bestDistractor = Math.max(
        0,
        ...options.filter((o) => o.id !== correct.id).map((o) => overlap(o.text)),
      );
      if (correctOverlap > 0 && correctOverlap > bestDistractor) {
        stemOverlap.push(
          `${it.title} / ${q.id}: correct option shares ${correctOverlap} word(s) with the stem, distractors at most ${bestDistractor}`,
        );
      }

      // ---- IR8 copyable key ----
      // The passage is on screen in full beside the stem. So for a sub-kind
      // whose answer is NOT meant to come from the passage, a key that appears
      // anywhere in the passage is COPYABLE — findable rather than known, and
      // answerable without English. That is the class this whole audit exists
      // to remove.
      //
      // The first version of this check required the stem to duplicate >=50% of
      // the sentence holding the key. Too narrow: a stem that paraphrases just
      // enough slips under the threshold while the key sits four lines above in
      // plain view. Measured on the first authored bank, that let 18 of 36
      // Complete the Sentences keys through. The rule is now absolute.
      //
      // HIGHLIGHT_THE_ANSWER and COMPLETE_THE_PASSAGE are exempt by design —
      // for those the answer legitimately comes from the passage.
      if (COPYABLE_KINDS.has(q.kind)) {
        const key = correct.text.trim().toLowerCase();
        if (passageTokens.has(key)) {
          copyable.push(
            `${it.title} / ${q.id}: key "${correct.text}" appears in the passage — it can be copied rather than chosen`,
          );
        }
      }
    }
  }

  report.push(`  INTERACTIVE_READING: ${items.length} set(s), ${selectCount} select question(s)`);
  report.push(`    IR1 options well-formed        : ${malformed.length === 0 ? "clean" : `${malformed.length} problem(s)`}`);
  report.push(`    IR5 passage spans usable       : ${spanProblem.length === 0 ? "clean" : `${spanProblem.length} problem(s)`}`);
  report.push(`    IR6 every question gradable    : ${unreachable.length === 0 ? "clean" : `${unreachable.length} problem(s)`}`);

  if (malformed.length) findings.push({ severity: "FAIL", code: "IR-MALFORMED", message: "A question's options are unusable.", items: malformed });
  if (spanProblem.length) findings.push({ severity: "FAIL", code: "IR-SPANS", message: "The passage cannot be spanned as required.", items: spanProblem });
  if (unreachable.length) findings.push({ severity: "FAIL", code: "IR-UNREACHABLE", message: "A question cannot be graded — its key does not resolve.", items: unreachable });

  // ---- IR2 length tell (bank-wide rate) ----
  if (selectCount > 0) {
    const rate = longestCorrect / selectCount;
    report.push(`    IR2 correct-is-longest         : ${longestCorrect}/${selectCount} (${Math.round(rate * 100)}%)`);
    if (rate >= LENGTH_TELL_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "IR-LENGTH-TELL",
        message:
          `The correct option is the longest in ${Math.round(rate * 100)}% of questions. "Pick the longest answer" ` +
          `is the oldest multiple-choice heuristic there is and needs no English — lengthen distractors or shorten keys.`,
        items: lengthTell.slice(0, 12),
      });
    }
  }

  // ---- IR3 position balance ----
  if (positions.length > 0) {
    const counts = new Map<number, number>();
    positions.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
    const ranked = [...counts].sort((a, b) => b[1] - a[1]);
    report.push(
      `    IR3 correct-answer position    : ${ranked.map(([p, c]) => `#${p + 1}→${c}`).join(", ")}`,
    );
    const [topPos, topCount] = ranked[0];
    if (topCount / positions.length >= POSITION_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "IR-POSITION-BIAS",
        message:
          `${Math.round((topCount / positions.length) * 100)}% of correct answers sit in position ${topPos + 1}. ` +
          `A taker who notices can score without reading.`,
      });
    }
  }

  report.push(`    IR4 stem-overlap tell          : ${stemOverlap.length === 0 ? "clean" : `${stemOverlap.length} question(s)`}`);
  report.push(`    IR8 key not copyable           : ${copyable.length === 0 ? "clean" : `${copyable.length} question(s)`}`);
  if (stemOverlap.length) {
    findings.push({
      severity: "FAIL",
      code: "IR-STEM-OVERLAP",
      message:
        `The correct option repeats words from the stem that the distractors do not. Word-matching answers it ` +
        `without comprehension — either echo the wording in a distractor too, or paraphrase the key.`,
      items: stemOverlap,
    });
  }

  if (copyable.length) {
    findings.push({
      severity: "FAIL",
      code: "IR-COPYABLE-KEY",
      message:
        `A Complete the Sentences stem duplicates a passage sentence that already contains the key, so the ` +
        `answer can be copied across rather than chosen. Paraphrase the stem, or test a word the passage ` +
        `does not supply.`,
      items: copyable,
    });
  }

  // ---- IR7 sub-kind coverage ----
  report.push("");
  const missingKinds = ALL_KINDS.filter((k) => !kindsSeen.has(k));
  report.push(`    IR7 sub-kinds used             : ${[...kindsSeen].sort().join(", ") || "none"}`);
  if (missingKinds.length) {
    findings.push({
      severity: "FAIL",
      code: "IR-KIND-COVERAGE",
      message: `Sub-kind(s) never used anywhere in the bank — a built kind with no content is a kind that has never actually run.`,
      items: missingKinds,
    });
  }

  // ---- IR7 rarity ladder ----
  const medians: { d: string; m: number }[] = [];
  for (const d of DIFFICULTIES) {
    const xs = rarityByDiff.get(d) ?? [];
    if (!xs.length) continue;
    const m = median(xs);
    medians.push({ d, m });
    report.push(`    ${d.padEnd(11)} passage median rank ${String(m).padStart(6)} over ${xs.length} content word(s)`);
  }
  for (let i = 1; i < medians.length; i++) {
    const prev = medians[i - 1];
    const cur = medians[i];
    if (cur.m < prev.m + MIN_RARITY_STEP) {
      findings.push({
        severity: "FAIL",
        code: "IR-DIFFICULTY-NOT-RARITY",
        message:
          `${cur.d} passages are not meaningfully rarer in vocabulary than ${prev.d} (median rank ${cur.m} vs ${prev.m}; ` +
          `at least +${MIN_RARITY_STEP} required). Difficulty must come from the language, not from passage length.`,
      });
    }
  }

  return { findings, report };
});
