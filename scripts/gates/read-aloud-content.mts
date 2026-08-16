// gate:read-aloud-content — is every sentence one a person can actually read out?
//
// Read Aloud has almost no structure to get wrong: the payload is one string.
// That is exactly why it goes wrong quietly — an empty sentence, a duplicate, or
// one too long to say in a breath all look perfectly healthy in the database and
// in every other check.
//
//   RA1 PRESENT      non-empty, and long enough to be a task rather than a word.
//   RA2 SAY-ABLE     inside a length a person reads comfortably in one breath,
//                    and well inside the recording limit. A sentence that runs
//                    past the limit is scored on a recording that was cut off.
//   RA3 TERMINAL     ends in . ! or ? — it is a sentence, and the full stop is
//                    what tells a reader where to stop.
//   RA4 REAL WORDS   every token is ordinary English, a capitalised proper noun,
//                    or a number. A word nobody can pronounce measures nothing.
//   RA5 UNIQUE       no sentence repeats another, so the bank is as big as it
//                    counts.
//
// RA4 EXEMPTS CAPITALISED TOKENS on purpose. A word list has no proper nouns in
// it, so checking every token against the dictionary would fail on any sentence
// with a name in it — the same false positive that made gate:il-cloze-audio
// report "check-up" as not a word. Being narrow and right beats being broad and
// switched off.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const READ_ALOUD = "READ_ALOUD";

const MIN_CHARS = 25;
/** Comfortably inside the 30-second recording limit at any reading pace. */
const MAX_CHARS = 200;
const MIN_WORDS = 4;
const MAX_WORDS = 30;

/** Letters, plus the apostrophe and hyphen that live inside ordinary words. */
const WORDLIKE = /^[A-Za-z]+(?:[-'’][A-Za-z]+)*$/;

export default defineGate("gate:read-aloud-content", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const items = bank.items.filter((i) => i.taskType === READ_ALOUD);
  if (items.length === 0) {
    report.push("  no READ_ALOUD items authored yet — nothing to check");
    return { findings, report };
  }

  const wordsModule = await import("an-array-of-english-words");
  const DICT = new Set(
    ((wordsModule.default ?? wordsModule) as unknown as string[]).map((w) => w.toLowerCase()),
  );

  const missing: string[] = [];
  const unsayable: string[] = [];
  const noTerminal: string[] = [];
  const notWords: string[] = [];
  const duplicate: string[] = [];

  const seen = new Map<string, string>();
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

  for (const it of items) {
    const text = typeof it.payload.text === "string" ? it.payload.text.trim() : "";

    // ---- RA1 present ----
    if (!text) {
      missing.push(`${it.title}: sentence is empty`);
      continue;
    }
    if (text.length < MIN_CHARS) {
      missing.push(`${it.title}: ${text.length} chars, floor is ${MIN_CHARS} — too short to be a task`);
    }

    const words = text.split(/\s+/).filter(Boolean);

    // ---- RA2 say-able ----
    if (text.length > MAX_CHARS || words.length > MAX_WORDS) {
      unsayable.push(
        `${it.title}: ${text.length} chars / ${words.length} words, caps are ${MAX_CHARS} / ${MAX_WORDS} — ` +
          `longer than one breath and at risk of running past the recording limit`,
      );
    }
    if (words.length < MIN_WORDS) {
      missing.push(`${it.title}: ${words.length} word(s), floor is ${MIN_WORDS}`);
    }

    // ---- RA3 terminal punctuation ----
    if (!/[.!?]["'’”)]?$/.test(text)) {
      noTerminal.push(`${it.title}: does not end in . ! or ? — "${text.slice(-24)}"`);
    }

    // ---- RA4 real words ----
    for (const raw of words) {
      const bare = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, "");
      if (!bare) continue;
      if (/^\d[\d,.]*$/.test(bare)) continue; // a numeral is readable
      if (/^[A-Z]/.test(bare)) continue; // proper noun, or sentence-initial
      if (!WORDLIKE.test(bare)) {
        notWords.push(`${it.title}: "${raw}" is not a pronounceable word form`);
        continue;
      }
      const stripped = bare.toLowerCase().replace(/[’']/g, "");
      const parts = bare.toLowerCase().split(/[-'’]/).filter(Boolean);
      const known =
        DICT.has(bare.toLowerCase()) ||
        DICT.has(stripped) ||
        (parts.length > 1 && parts.every((p) => DICT.has(p)));
      if (!known) notWords.push(`${it.title}: "${raw}" is not in the English word list`);
    }

    // ---- RA5 unique ----
    const key = norm(text);
    const prev = seen.get(key);
    if (prev) duplicate.push(`${it.title}: repeats the sentence of "${prev}"`);
    else seen.set(key, it.title);
  }

  report.push(`  READ_ALOUD: ${items.length} sentence(s)`);
  report.push(`    RA1 present + long enough   : ${missing.length === 0 ? "clean" : `${missing.length} problem(s)`}`);
  report.push(`    RA2 say-able in one breath  : ${unsayable.length === 0 ? "clean" : `${unsayable.length} problem(s)`}`);
  report.push(`    RA3 ends in . ! or ?        : ${noTerminal.length === 0 ? "clean" : `${noTerminal.length} problem(s)`}`);
  report.push(`    RA4 every word pronounceable: ${notWords.length === 0 ? "clean" : `${notWords.length} problem(s)`}`);
  report.push(`    RA5 no duplicate sentence   : ${duplicate.length === 0 ? "clean" : `${duplicate.length} duplicate(s)`}`);

  if (missing.length) {
    findings.push({
      severity: "FAIL",
      code: "READ-ALOUD-EMPTY",
      message: `A sentence is empty or too short to be a task. Nothing else notices an item with nothing to read.`,
      items: missing,
    });
  }
  if (unsayable.length) {
    findings.push({
      severity: "FAIL",
      code: "READ-ALOUD-TOO-LONG",
      message:
        `A sentence is longer than one comfortable breath. The recording stops at the task's limit, so an ` +
        `over-long sentence is scored against a recording that was cut off mid-way.`,
      items: unsayable,
    });
  }
  if (noTerminal.length) {
    findings.push({
      severity: "FAIL",
      code: "READ-ALOUD-NO-TERMINAL",
      message: `A sentence does not end in terminal punctuation, so a reader is not told where it stops.`,
      items: noTerminal,
    });
  }
  if (notWords.length) {
    findings.push({
      severity: "FAIL",
      code: "READ-ALOUD-NOT-A-WORD",
      message:
        `A token is not a pronounceable English word. Capitalised tokens are exempt as proper nouns; ` +
        `everything else has to be sayable, or the item measures the transcriber rather than the speaker.`,
      items: notWords,
    });
  }
  if (duplicate.length) {
    findings.push({
      severity: "FAIL",
      code: "READ-ALOUD-DUPLICATE",
      message: `The same sentence appears on more than one item — the bank is smaller than it counts.`,
      items: duplicate,
    });
  }

  return { findings, report };
});
