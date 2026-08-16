// gate:writing-prompts — is there actually a task to do?
//
// A free-text writing item has almost no structure to get wrong, which is
// exactly why it goes wrong quietly. There is no key to mis-key and no option to
// mis-order; an item with an empty prompt, or one that repeats another item's
// prompt, looks perfectly healthy in every other check and in the database.
//
//   WP1 PRESENT      every prompt non-empty after trimming, and long enough to
//                    set a real task.
//   WP2 READABLE     not so long that the task cannot be read in the time given.
//                    Writing Sample gets 30 seconds, so its cap is tighter.
//   WP3 DISTINCT     Interactive Writing's two parts must differ. A follow-up
//                    that restates the first prompt is not a second task, and the
//                    Part 1 lock then guards nothing.
//   WP4 NO DUPLICATE no prompt repeats another item's, per type. A repeated
//                    prompt shortens the bank in practice while the item count
//                    says otherwise.
//   WP5 RUBRIC       traits and reference both present — without a reference the
//                    rater has nothing to mark against and silently falls back to
//                    a general impression.
//   WP6 DEPENDENT    (WARN) Interactive Writing's Part 2 should refer back to
//                    Part 1. Advisory, not blocking: this is a heuristic on
//                    wording, and a gate that blocks on prose style is a gate
//                    someone switches off.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const IW = "INTERACTIVE_WRITING";
const WS = "WRITING_SAMPLE";

/** A prompt shorter than this is not setting a task. */
const MIN_PROMPT_CHARS = 40;
/** Interactive Writing parts get 5 and 3 minutes — a long prompt is affordable. */
const MAX_PROMPT_CHARS = 600;
/** Writing Sample gives 30 seconds of reading time. Measured at a conservative
 *  ~4.5 chars/word and ~200 wpm, 30s is roughly 400 characters. */
const MAX_WS_PROMPT_CHARS = 400;

/** Wording that shows Part 2 is anchored to Part 1 rather than free-standing. */
const BACKREF = [
  "part 1",
  "you did not",
  "you did not",
  "you mentioned",
  "you chose",
  "you picked",
  "your answer",
  "your response",
  "you wrote",
  "the option you",
  "opposite",
  "earlier",
];

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

export default defineGate("gate:writing-prompts", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const iwItems = bank.items.filter((i) => i.taskType === IW);
  const wsItems = bank.items.filter((i) => i.taskType === WS);
  if (iwItems.length === 0 && wsItems.length === 0) {
    report.push("  no INTERACTIVE_WRITING or WRITING_SAMPLE items authored yet — nothing to check");
    return { findings, report };
  }

  const missing: string[] = [];
  const tooLong: string[] = [];
  const notDistinct: string[] = [];
  const duplicate: string[] = [];
  const badRubric: string[] = [];
  const standalone: string[] = [];

  /** Every prompt in the bank, per type, for the duplicate check. */
  const seen = new Map<string, Map<string, string>>();
  const notePrompt = (type: string, where: string, prompt: string): void => {
    const byType = seen.get(type) ?? new Map<string, string>();
    const key = norm(prompt);
    const prev = byType.get(key);
    if (prev) duplicate.push(`${type}: "${where}" repeats the prompt of "${prev}"`);
    else byType.set(key, where);
    seen.set(type, byType);
  };

  const checkPrompt = (where: string, prompt: unknown, maxChars: number): string | null => {
    if (typeof prompt !== "string" || !prompt.trim()) {
      missing.push(`${where}: prompt is empty`);
      return null;
    }
    const t = prompt.trim();
    if (t.length < MIN_PROMPT_CHARS) {
      missing.push(`${where}: prompt is ${t.length} chars, floor is ${MIN_PROMPT_CHARS} — too short to set a task`);
    }
    if (t.length > maxChars) {
      tooLong.push(`${where}: prompt is ${t.length} chars, cap is ${maxChars}`);
    }
    return t;
  };

  const checkRubric = (where: string, rubric: unknown): void => {
    const r = (rubric ?? {}) as { traits?: unknown; reference?: unknown };
    if (!Array.isArray(r.traits) || r.traits.length === 0) {
      badRubric.push(`${where}: rubric.traits is empty — nothing named for the rater to report`);
    }
    if (typeof r.reference !== "string" || !r.reference.trim()) {
      badRubric.push(
        `${where}: rubric.reference is empty — the rater has no target and falls back to a general impression`,
      );
    }
  };

  // ---------------------------------------------------- INTERACTIVE_WRITING --
  for (const it of iwItems) {
    const p = it.payload as {
      part1?: { prompt?: unknown };
      part2?: { prompt?: unknown };
      rubric?: unknown;
    };
    const p1 = checkPrompt(`${IW} / ${it.title} / part1`, p.part1?.prompt, MAX_PROMPT_CHARS);
    const p2 = checkPrompt(`${IW} / ${it.title} / part2`, p.part2?.prompt, MAX_PROMPT_CHARS);
    checkRubric(`${IW} / ${it.title}`, p.rubric);

    if (p1 && p2) {
      if (norm(p1) === norm(p2)) {
        notDistinct.push(`${IW} / ${it.title}: part1 and part2 are the same prompt`);
      }
      notePrompt(IW, `${it.title} / part1`, p1);
      notePrompt(IW, `${it.title} / part2`, p2);

      // ---- WP6 does Part 2 depend on Part 1? ----
      const low = norm(p2);
      if (!BACKREF.some((cue) => low.includes(cue))) {
        standalone.push(
          `${IW} / ${it.title}: part2 never refers back to part1 — it may be answerable on its own`,
        );
      }
    }
  }

  // -------------------------------------------------------- WRITING_SAMPLE --
  for (const it of wsItems) {
    const p = it.payload as { prompt?: unknown; rubric?: unknown; targetWords?: unknown };
    const prompt = checkPrompt(`${WS} / ${it.title}`, p.prompt, MAX_WS_PROMPT_CHARS);
    checkRubric(`${WS} / ${it.title}`, p.rubric);
    if (prompt) notePrompt(WS, it.title, prompt);
    if (typeof p.targetWords !== "string" || !p.targetWords.trim()) {
      badRubric.push(`${WS} / ${it.title}: targetWords is empty — the taker is given no length to aim at`);
    }
  }

  const total = iwItems.length + wsItems.length;
  report.push(`  ${IW}: ${iwItems.length} item(s) · ${WS}: ${wsItems.length} item(s)`);
  report.push(`    WP1 prompts present + long enough : ${missing.length === 0 ? "clean" : `${missing.length} problem(s)`}`);
  report.push(`    WP2 prompts readable in the time  : ${tooLong.length === 0 ? "clean" : `${tooLong.length} problem(s)`}`);
  report.push(`    WP3 IW part1 differs from part2   : ${notDistinct.length === 0 ? "clean" : `${notDistinct.length} problem(s)`}`);
  report.push(`    WP4 no duplicate prompt per type  : ${duplicate.length === 0 ? "clean" : `${duplicate.length} duplicate(s)`}`);
  report.push(`    WP5 rubric usable                 : ${badRubric.length === 0 ? "clean" : `${badRubric.length} problem(s)`}`);
  report.push(`    (checked ${total} item(s))`);

  if (missing.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-PROMPT-MISSING",
      message: `A prompt is empty or too short to set a task. Nothing else in the pipeline notices an item with no task in it.`,
      items: missing,
    });
  }
  if (tooLong.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-PROMPT-TOO-LONG",
      message:
        `A prompt cannot be read in the time the taker is given. Writing Sample allows 30 seconds ` +
        `of reading before the textarea opens, so its prompt has the tighter cap.`,
      items: tooLong,
    });
  }
  if (notDistinct.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-PARTS-IDENTICAL",
      message:
        `Interactive Writing's two prompts are the same. A follow-up that restates the first prompt ` +
        `is not a second task, and locking Part 1 then guards nothing.`,
      items: notDistinct,
    });
  }
  if (duplicate.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-PROMPT-DUPLICATE",
      message:
        `The same prompt appears on more than one item. The bank is effectively smaller than it ` +
        `counts, and a taker can meet the identical task twice in one session.`,
      items: duplicate,
    });
  }
  if (badRubric.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-RUBRIC-UNUSABLE",
      message:
        `A rubric cannot do its job. Without a reference the AI rater has no target and marks on a ` +
        `general impression — which reads like a score and is not one.`,
      items: badRubric,
    });
  }
  if (standalone.length) {
    findings.push({
      severity: "WARN",
      code: "WRITING-PART2-STANDALONE",
      message:
        `Interactive Writing's Part 2 does not refer back to Part 1 in any obvious way. Advisory — ` +
        `this is a wording heuristic, not a rule — but if Part 2 really is answerable on its own, ` +
        `the whole locked-progressive design is protecting nothing.`,
      items: standalone,
    });
  }

  return { findings, report };
});
