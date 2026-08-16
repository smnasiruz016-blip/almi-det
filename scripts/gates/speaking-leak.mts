// gate:speaking-leak — STUB, deliberately, and it says so out loud.
//
// Read Aloud is the only speaking type today and it has NOTHING TO HIDE: the
// sentence is the stimulus, on screen, because reading it aloud is the task. So
// there is no rubric, no reference, and no key to withhold — and a leak check
// over it would be a check with nothing to check, reporting green forever while
// looking like coverage.
//
// This file exists so that the moment a speaking type WITH a rubric lands —
// Speaking Sample and Interactive Speaking both will — the gate is already wired
// into gate:all and the person adding the type finds a place to put the check
// rather than deciding whether to bother.
//
// WHAT IT WILL DO, and the rule is already settled by the writing types:
// `rubric.reference` is the AI rater's target in prose, an answer key under
// another name, so it must never be projected. gate:writing-leak WL1-WL3 is the
// pattern to copy — forbidden keys, a field whitelist per projection, and a
// value scan for the long-form reference.
//
// UNTIL THEN IT REPORTS WHAT IT IS. A stub that printed "clean" would be
// indistinguishable from a passing check; this one names the types it would
// cover and states that none of them exist yet, so nobody reads it as coverage.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

/** Speaking types whose payload will carry a server-only rubric. Add here as
 *  they land; the check turns itself on when the bank first holds one. */
const RUBRIC_SPEAKING_TYPES = ["SPEAKING_SAMPLE", "INTERACTIVE_SPEAKING"];

export default defineGate("gate:speaking-leak", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const present = RUBRIC_SPEAKING_TYPES.filter((t) => bank.items.some((i) => i.taskType === t));

  report.push("  STUB — no speaking type carries a rubric yet, so there is nothing to withhold.");
  report.push(
    `    watching for            : ${RUBRIC_SPEAKING_TYPES.join(", ")}  (none in the bank)`,
  );
  report.push(
    "    READ_ALOUD is exempt    : the sentence IS the stimulus — it is shown on purpose, not leaked.",
  );
  report.push(
    "    when one lands          : copy gate:writing-leak WL1-WL3 — forbidden keys, per-projection",
  );
  report.push(
    "                              whitelist, and a value scan for rubric.reference.",
  );

  if (present.length > 0) {
    // The bank now holds a type this gate was written for and the check is still
    // a stub. Failing is the only honest outcome: a green stub over content with
    // a rubric would be a leak gate that has never looked at a rubric.
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-LEAK-STUB-OUTGROWN",
      message:
        `A speaking type with a rubric is now in the bank, and this gate is still a stub. Implement ` +
        `the checks before this content can ship — a stub reporting green over a server-only ` +
        `reference is worse than no gate, because it looks like coverage.`,
      items: present,
    });
  }

  return { findings, report };
});
