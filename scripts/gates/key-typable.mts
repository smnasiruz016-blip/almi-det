// gate:key-typable — can a person who knows the answer actually score it?
//
// The trap this gate is built to avoid: scoring the key against ITSELF. Both
// sides run through the same normaliser, so `score(key, key)` returns 1.0 for
// every key ever written, including keys no human can type. It proves nothing.
//
// So every check here feeds a DIFFERENT string on the response side — one a real
// person would plausibly produce — and asserts the REAL scorer still returns
// full marks:
//
//   K1 non-empty      the key must survive normalisation at all
//   K2 plain keyboard typographic characters replaced with ASCII equivalents
//   K3 no punctuation the documented "punctuation-insensitive" promise, tested
//   K4 digits         digits are heard as words; one of the two forms will lose
//
// Objective-key integrity for READ_AND_SELECT is checked structurally, including
// the cross-item contradiction that no single-item check can see.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const TYPOGRAPHIC: [RegExp, string][] = [
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, "-"],
  [/…/g, "..."],
  [/ /g, " "],
];

const toPlainKeyboard = (s: string): string =>
  TYPOGRAPHIC.reduce((acc, [re, rep]) => acc.replace(re, rep), s);

const stripPunctuation = (s: string): string => s.replace(/[^\p{L}\p{N}\s]/gu, "");

export default defineGate("gate:key-typable", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const { scoreListenAndType } = await import("../../src/lib/det/tasks/listen-and-type");
  const score = (sentence: string, typed: string): number =>
    scoreListenAndType({ sentence }, { typed }).fraction;

  // ================= LISTEN_AND_TYPE =================
  const listen = bank.items.filter((i) => i.taskType === "LISTEN_AND_TYPE");
  const k1: string[] = [];
  const k2: string[] = [];
  const k3: string[] = [];
  const k4: string[] = [];

  for (const it of listen) {
    const sentence = String(it.payload.sentence ?? "");

    // K1 — a key that normalises to nothing is unanswerable.
    const tokens = sentence
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) {
      k1.push(`${it.title}: key normalises to empty — unanswerable`);
      continue;
    }
    if (tokens.length < 3) {
      k1.push(`${it.title}: key normalises to only ${tokens.length} token(s)`);
    }

    // K2 — a plain-keyboard typist must not be penalised.
    const plain = toPlainKeyboard(sentence);
    if (plain !== sentence) {
      const f = score(sentence, plain);
      if (f < 1) {
        k2.push(
          `${it.title}: typing the ASCII form scores ${(f * 100).toFixed(0)}% — key contains a typographic character`,
        );
      }
    }

    // K3 — the module documents punctuation-insensitive marking. Prove it.
    const bare = stripPunctuation(sentence);
    if (bare !== sentence) {
      const f = score(sentence, bare);
      if (f < 1) {
        k3.push(`${it.title}: dropping punctuation scores ${(f * 100).toFixed(0)}%, not 100%`);
      }
    }

    // K4 — digits are spoken as words; the taker cannot know which form is keyed.
    if (/\d/.test(sentence)) {
      k4.push(`${it.title}: key contains digits ("${sentence.match(/\d[\d,.]*/g)?.join('", "')}")`);
    }
  }

  report.push(`  LISTEN_AND_TYPE: ${listen.length} key(s) checked`);
  report.push(`    K1 normalises to usable tokens : ${listen.length - k1.length}/${listen.length}`);
  report.push(`    K2 plain-keyboard round-trip   : ${listen.length - k2.length}/${listen.length}`);
  report.push(`    K3 punctuation-insensitive     : ${listen.length - k3.length}/${listen.length}`);
  report.push(`    K4 free of digit ambiguity     : ${listen.length - k4.length}/${listen.length}`);

  if (k1.length) findings.push({ severity: "FAIL", code: "KEY-UNANSWERABLE", message: "Key does not survive normalisation.", items: k1 });
  if (k2.length) findings.push({ severity: "FAIL", code: "KEY-NOT-TYPABLE", message: "A correct answer typed on a plain keyboard loses marks.", items: k2 });
  if (k3.length) findings.push({ severity: "FAIL", code: "KEY-PUNCTUATION-SENSITIVE", message: "Marking is not punctuation-insensitive as documented.", items: k3 });
  if (k4.length) findings.push({ severity: "WARN", code: "KEY-DIGIT-AMBIGUITY", message: "Digits in a listening key: the taker cannot know whether to type '7' or 'seven'.", items: k4 });

  // ================= READ_AND_SELECT =================
  const ras = bank.items.filter((i) => i.taskType === "READ_AND_SELECT");
  const structural: string[] = [];
  const seen = new Map<string, { real: boolean; title: string }>();
  const contradictions: string[] = [];

  for (const it of ras) {
    const words = (it.payload.words as { id: string; text: string; real: boolean }[] | undefined) ?? [];
    const ids = words.map((w) => w.id);
    if (new Set(ids).size !== ids.length) structural.push(`${it.title}: duplicate word id`);
    const texts = words.map((w) => w.text.toLowerCase());
    if (new Set(texts).size !== texts.length) structural.push(`${it.title}: duplicate word text`);
    if (!words.some((w) => w.real)) structural.push(`${it.title}: no real words — nothing to select`);
    if (!words.some((w) => !w.real)) structural.push(`${it.title}: no invented words — select-all wins`);
    for (const w of words) {
      if (/\s/.test(w.text)) structural.push(`${it.title}: candidate "${w.text}" contains whitespace`);
      const prev = seen.get(w.text.toLowerCase());
      if (prev && prev.real !== w.real) {
        contradictions.push(`"${w.text}": real=${prev.real} in "${prev.title}" but real=${w.real} in "${it.title}"`);
      } else if (!prev) {
        seen.set(w.text.toLowerCase(), { real: w.real, title: it.title });
      }
    }
  }

  report.push(`  READ_AND_SELECT: ${ras.length} item(s), ${seen.size} distinct candidate words`);
  report.push(`    structural integrity           : ${structural.length === 0 ? "clean" : `${structural.length} problem(s)`}`);
  report.push(`    cross-item key agreement       : ${contradictions.length === 0 ? "clean" : `${contradictions.length} contradiction(s)`}`);

  if (structural.length) findings.push({ severity: "FAIL", code: "KEY-STRUCTURE", message: "Objective key is structurally unusable.", items: structural });
  if (contradictions.length) findings.push({ severity: "FAIL", code: "KEY-CONTRADICTION", message: "The same word is keyed both real and invented in different items.", items: contradictions });

  report.push("");
  report.push("  NOT COVERED by this gate: whether an item's 'invented' words are genuinely");
  report.push("  non-words in English. That needs a dictionary the repo does not carry —");
  report.push("  it stays a human review step, not a silent gap.");

  return { findings, report };
});
