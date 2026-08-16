// gate:speaking-prompts — is there actually something to answer?
//
// The three rubric-based speaking types have almost no structure to get wrong:
// one string of task text and one rubric. That is exactly why it goes wrong
// quietly — an empty prompt, a repeated one, or a question too long to hold in
// the head all look perfectly healthy in the database and in every other check.
//
//   SP1 PRESENT     task text non-empty and long enough to set a task.
//   SP2 LENGTH      inside a length that fits how it is DELIVERED. The two
//                   printed types can afford a longer prompt than the one that
//                   is heard once with nothing to re-read.
//   SP3 DISTINCT    no prompt or question repeats another of the same type.
//   SP4 RUBRIC      traits and reference both present — without a reference the
//                   rater has no target and marks on a general impression.
//   SP5 NO LEAK-BY-PROSE  a Listen Then Speak QUESTION must not also appear as a
//                   printed prompt on some other item, which would put the same
//                   text on screen for one item and in the ear for another.
//
// SP2's TIGHTER CAP FOR LISTEN THEN SPEAK IS THE POINT OF THIS GATE. A printed
// prompt can be re-read; a spoken question is heard once and cannot. A question
// long enough to need re-reading is one nobody can answer, and no other check in
// the suite has any opinion about how long it is.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const RTS = "READ_THEN_SPEAK";
const LTS = "LISTEN_THEN_SPEAK";
const SS = "SPEAKING_SAMPLE";

const MIN_CHARS = 40;
/** Printed and re-readable for as long as the taker likes. */
const MAX_PRINTED_CHARS = 400;
/** Heard once, with nothing to go back to. Deliberately tighter. */
const MAX_SPOKEN_CHARS = 220;

/** Which payload field carries the task, and how it reaches the taker. */
const SPEC: Record<string, { field: string; max: number; how: string }> = {
  [RTS]: { field: "prompt", max: MAX_PRINTED_CHARS, how: "printed" },
  [LTS]: { field: "question", max: MAX_SPOKEN_CHARS, how: "heard once" },
  [SS]: { field: "prompt", max: MAX_PRINTED_CHARS, how: "printed" },
};

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

export default defineGate("gate:speaking-prompts", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const types = Object.keys(SPEC);
  const items = bank.items.filter((i) => types.includes(i.taskType));
  if (items.length === 0) {
    report.push("  no rubric-based speaking items authored yet — nothing to check");
    return { findings, report };
  }

  const missing: string[] = [];
  const tooLong: string[] = [];
  const duplicate: string[] = [];
  const badRubric: string[] = [];
  const crossMode: string[] = [];

  const seen = new Map<string, Map<string, string>>();
  const spokenText = new Map<string, string>();
  const printedText = new Map<string, string>();

  for (const it of items) {
    const spec = SPEC[it.taskType];
    const where = `${it.taskType} / ${it.title}`;
    const raw = it.payload[spec.field];
    const text = typeof raw === "string" ? raw.trim() : "";

    // ---- SP1 present ----
    if (!text) {
      missing.push(`${where}: ${spec.field} is empty`);
    } else if (text.length < MIN_CHARS) {
      missing.push(
        `${where}: ${spec.field} is ${text.length} chars, floor is ${MIN_CHARS} — too short to set a task`,
      );
    }

    // ---- SP2 length, by delivery ----
    if (text && text.length > spec.max) {
      tooLong.push(
        `${where}: ${text.length} chars, cap is ${spec.max} for a ${spec.how} task` +
          (spec.how === "heard once"
            ? " — a question this long cannot be held in the head on one listen"
            : ""),
      );
    }

    // ---- SP3 distinct within the type ----
    if (text) {
      const byType = seen.get(it.taskType) ?? new Map<string, string>();
      const key = norm(text);
      const prev = byType.get(key);
      if (prev) duplicate.push(`${it.taskType}: "${it.title}" repeats the ${spec.field} of "${prev}"`);
      else byType.set(key, it.title);
      seen.set(it.taskType, byType);

      if (it.taskType === LTS) spokenText.set(norm(text), it.title);
      else printedText.set(norm(text), it.title);
    }

    // ---- SP4 rubric usable ----
    const rubric = (it.payload.rubric ?? {}) as { traits?: unknown; reference?: unknown };
    if (!Array.isArray(rubric.traits) || rubric.traits.length === 0) {
      badRubric.push(`${where}: rubric.traits is empty — nothing named for the rater to report`);
    }
    if (typeof rubric.reference !== "string" || !rubric.reference.trim()) {
      badRubric.push(
        `${where}: rubric.reference is empty — the rater has no target and falls back to a general impression`,
      );
    }
  }

  // ---- SP5 the same text must not be both heard and printed ----
  for (const [key, ltsTitle] of spokenText) {
    const printed = printedText.get(key);
    if (printed) {
      crossMode.push(
        `"${ltsTitle}" is HEARD as a Listen Then Speak question while "${printed}" PRINTS the same text — ` +
          `one item's listening task is another item's reading`,
      );
    }
  }

  const n = (t: string) => items.filter((i) => i.taskType === t).length;
  report.push(`  ${RTS}: ${n(RTS)} · ${LTS}: ${n(LTS)} · ${SS}: ${n(SS)} item(s)`);
  report.push(`    SP1 task text present         : ${missing.length === 0 ? "clean" : `${missing.length} problem(s)`}`);
  report.push(
    `    SP2 length fits the delivery  : ${tooLong.length === 0 ? `clean (printed <=${MAX_PRINTED_CHARS}, spoken <=${MAX_SPOKEN_CHARS})` : `${tooLong.length} problem(s)`}`,
  );
  report.push(`    SP3 no duplicate per type     : ${duplicate.length === 0 ? "clean" : `${duplicate.length} duplicate(s)`}`);
  report.push(`    SP4 rubric usable             : ${badRubric.length === 0 ? "clean" : `${badRubric.length} problem(s)`}`);
  report.push(`    SP5 spoken text never printed : ${crossMode.length === 0 ? "clean" : `${crossMode.length} collision(s)`}`);

  if (missing.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-PROMPT-MISSING",
      message: `A spoken task has no text to answer. Nothing else in the pipeline notices an item with no task in it.`,
      items: missing,
    });
  }
  if (tooLong.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-PROMPT-TOO-LONG",
      message:
        `A task is longer than its delivery allows. A printed prompt can be re-read; a Listen Then ` +
        `Speak question is heard once and cannot be, so its cap is tighter.`,
      items: tooLong,
    });
  }
  if (duplicate.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-PROMPT-DUPLICATE",
      message: `The same task text appears on more than one item — the bank is smaller than it counts.`,
      items: duplicate,
    });
  }
  if (badRubric.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-RUBRIC-UNUSABLE",
      message:
        `A rubric cannot do its job. Without a reference the rater has no target and marks on a general ` +
        `impression — which reads like a score and is not one.`,
      items: badRubric,
    });
  }
  if (crossMode.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-TEXT-BOTH-MODES",
      message:
        `Text used as a spoken question is also printed on another item. The whole point of Listen ` +
        `Then Speak is that the question is heard, not read.`,
      items: crossMode,
    });
  }

  return { findings, report };
});
