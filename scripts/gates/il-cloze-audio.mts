// gate:il-cloze-audio — Part A, where a listening gap can quietly become a
// reading one.
//
//   A1 COUNT        3-4 blanks. Fewer is not a task; more turns a short message
//                   into a transcription exercise.
//   A2 REAL WORD    every blanked word is in the English word list.
//   A3 TYPABLE      letters, hyphen and apostrophe only. The taker types this on
//                   a plain keyboard with no prefix to copy from, so anything
//                   else is unanswerable as keyed.
//   A4 WHOLE WORD   NO PREFIX REVEAL. The literal chunk before a gap must end at
//                   a word boundary and the chunk after must start at one.
//   A5 IN THE AUDIO the blanked word must appear verbatim in what the voice
//                   actually says.
//
// A4 IS THE AXIS THIS TASK TYPE OWNS. The reading cloze types deliberately show
// a visiblePrefix and a blank length — with no audio, the taker needs them. Here
// the audio supplies the word, so a revealed prefix converts a listening item
// into a spelling puzzle that can be solved with the sound off. Nothing in the
// payload shape prevents an author writing `"...in the li", {missing:"brary"}` —
// it would parse, project, and grade. Only this check catches it.
//
// A5 IS NOT VACUOUS, THOUGH IT LOOKS IT. With no `complete.audioScript` the
// spoken text IS the assembled transcript, so the word is present by
// construction and A5 passes for free. It becomes load-bearing the moment an
// author writes an audioScript to make the delivery sound natural: paraphrase
// away a blanked word and the item is unanswerable as spoken, with nothing else
// in the pipeline to say so. That is the same defect gate:leak's AUDIO-KEY-MISMATCH
// catches for Listen and Type, one task type over.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";
import { loadIL } from "./_il.mjs";

const MIN_BLANKS = 3;
const MAX_BLANKS = 4;

/** Letters, plus the hyphen and apostrophe that live inside ordinary English
 *  words. Must start and end with a letter. */
const TYPABLE = /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/;

/** A literal chunk may end a gap's left edge only on whitespace or an opening
 *  bracket/quote — anything else glues the gap onto a word fragment. */
const ENDS_AT_BOUNDARY = /(^|[\s("'‘“])$/;
/** ...and may resume only on whitespace or trailing punctuation. */
const STARTS_AT_BOUNDARY = /^([\s.,!?;:)"'’”]|$)/;

export default defineGate("gate:il-cloze-audio", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const il = await loadIL(bank);
  findings.push(...il.findings);

  if (il.total === 0) {
    report.push("  no INTERACTIVE_LISTENING items authored yet — nothing to check");
    return { findings, report };
  }

  const { completeBlanks, spokenScenario } = await import(
    "../../src/lib/det/tasks/interactive-listening"
  );
  const wordsModule = await import("an-array-of-english-words");
  const DICT = new Set(
    ((wordsModule.default ?? wordsModule) as unknown as string[]).map((w) => w.toLowerCase()),
  );

  const count: string[] = [];
  const notWord: string[] = [];
  const untypable: string[] = [];
  const prefixReveal: string[] = [];
  const notSpoken: string[] = [];
  let blankTotal = 0;

  for (const { title, payload } of il.parsed) {
    const chunks = payload.complete.text;
    const blanks = completeBlanks(chunks);
    blankTotal += blanks.length;

    // ---- A1 count ----
    if (blanks.length < MIN_BLANKS || blanks.length > MAX_BLANKS) {
      count.push(`${title}: ${blanks.length} blank(s), rule is ${MIN_BLANKS}-${MAX_BLANKS}`);
    }

    const spoken = spokenScenario(payload).toLowerCase();
    const scripted = payload.complete.audioScript !== undefined;

    for (const b of blanks) {
      const where = `${title} / ${b.id}`;
      const candidates = [b.missing, ...b.alsoAccept];

      for (const w of candidates) {
        const label = w === b.missing ? "" : ` (alsoAccept "${w}")`;

        // ---- A3 typable ----
        if (!TYPABLE.test(w)) {
          untypable.push(
            `${where}${label}: "${w}" is not typable as keyed — letters, hyphen and apostrophe only`,
          );
        }
        // ---- A2 real word ----
        if (!DICT.has(w.toLowerCase())) {
          notWord.push(`${where}${label}: "${w}" is not in the English word list`);
        }
      }

      // ---- A4 whole word, no prefix revealed ----
      const before = chunks[b.at - 1];
      const after = chunks[b.at + 1];
      const beforeText = b.at === 0 ? "" : typeof before === "string" ? before : null;
      const afterText =
        b.at === chunks.length - 1 ? "" : typeof after === "string" ? after : null;

      if (beforeText === null || afterText === null) {
        prefixReveal.push(
          `${where}: sits directly against another blank — two gaps with no readable text between them`,
        );
      } else {
        if (!ENDS_AT_BOUNDARY.test(beforeText)) {
          prefixReveal.push(
            `${where}: the text before the gap ends mid-word ("…${beforeText.slice(-14)}"), so part of ` +
              `"${b.missing}" is already on screen — the gap is solvable by spelling, with the audio off`,
          );
        }
        if (!STARTS_AT_BOUNDARY.test(afterText)) {
          prefixReveal.push(
            `${where}: the text after the gap resumes mid-word ("${afterText.slice(0, 14)}…"), so the ` +
              `taker is typing a word fragment rather than the word`,
          );
        }
      }

      // ---- A5 verbatim in the audio ----
      const re = new RegExp(`(^|[^a-z])${b.missing.toLowerCase()}([^a-z]|$)`);
      if (!re.test(spoken)) {
        notSpoken.push(
          `${where}: "${b.missing}" does not appear in what the voice says` +
            (scripted ? " (complete.audioScript overrides the transcript)" : ""),
        );
      }
    }
  }

  report.push(`  INTERACTIVE_LISTENING: ${il.parsed.length} conversation(s), ${blankTotal} blank(s)`);
  report.push(`    A1 3-4 blanks per item        : ${count.length === 0 ? "clean" : `${count.length} item(s) off-rule`}`);
  report.push(`    A2 blanked word is real English: ${notWord.length === 0 ? "clean" : `${notWord.length} problem(s)`}`);
  report.push(`    A3 key typable on a keyboard  : ${untypable.length === 0 ? "clean" : `${untypable.length} problem(s)`}`);
  report.push(`    A4 whole word, no prefix shown : ${prefixReveal.length === 0 ? "clean" : `${prefixReveal.length} problem(s)`}`);
  report.push(`    A5 word is verbatim in the audio: ${notSpoken.length === 0 ? "clean" : `${notSpoken.length} problem(s)`}`);

  if (count.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-CLOZE-BLANK-COUNT",
      message: `Part A must carry ${MIN_BLANKS}-${MAX_BLANKS} blanks.`,
      items: count,
    });
  }
  if (notWord.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-CLOZE-NOT-A-WORD",
      message: `A blanked word is not an English word, so no listener could type it.`,
      items: notWord,
    });
  }
  if (untypable.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-CLOZE-UNTYPABLE",
      message:
        `A key contains characters a taker cannot type. There is no visible prefix in this task ` +
        `type to copy from — whatever is keyed is what has to be typed in full.`,
      items: untypable,
    });
  }
  if (prefixReveal.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-CLOZE-PREFIX-REVEAL",
      message:
        `A gap is not a whole word. The audio supplies the word here, which is why this task type ` +
        `shows no prefix and no letter count — revealing part of the spelling turns a listening item ` +
        `into a reading one that can be solved with the sound off.`,
      items: prefixReveal,
    });
  }
  if (notSpoken.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-CLOZE-NOT-IN-AUDIO",
      message:
        `A blanked word is not in what the voice actually says, so the item is unanswerable as spoken. ` +
        `This is what an audioScript written for natural delivery costs when it paraphrases a key away.`,
      items: notSpoken,
    });
  }

  return { findings, report };
});
