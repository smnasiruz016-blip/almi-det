// gate:min-items — RULE 7.
//
// HARD LINE (blocks the build): >= 15 items per SKILL (Reading, Writing,
// Listening, Speaking). That is the owner's rule and the only thing that fails.
//
// ALSO HARD-FAILS: a DetTaskType enum member with no DET_TASKS entry. Skill is
// derived through the registry, so an unmapped type would contribute items to
// NO skill — the floor would read green on incomplete data. Never skip it.
//
// REPORTED, NOT ENFORCED (the masterpiece target): >= 15 per task type, spread
// ~5+ across the three difficulty pools. Reported so depth is visible, and so
// the zero-redundancy fragility is visible — today each skill is carried by a
// single task type, so retiring one type takes its skill from 18 to 0 outright
// rather than degrading gradually.

import { defineGate, SKILLS, DIFFICULTIES, type Bank, type Finding } from "./_bank.mjs";

const SKILL_FLOOR = 15;
const MASTERPIECE_PER_TYPE = 15;
const MASTERPIECE_PER_CELL = 5;

export default defineGate("gate:min-items", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  // ---- HARD: every enum member must be mapped in the registry ----
  if (bank.unmappedTaskTypes.length > 0) {
    findings.push({
      severity: "FAIL",
      code: "REGISTRY-UNMAPPED",
      message:
        `${bank.unmappedTaskTypes.length} DetTaskType enum member(s) have no DET_TASKS entry. ` +
        `Skill is derived from the registry, so their items count toward NO skill and the ` +
        `floor below would be computed on incomplete data.`,
      items: bank.unmappedTaskTypes,
    });
  }

  // ---- HARD: >= 15 per skill ----
  report.push("  Rule 7 — HARD LINE: >= 15 items per skill");
  const bySkill = new Map<string, number>();
  for (const s of SKILLS) bySkill.set(s, 0);
  for (const it of bank.items) bySkill.set(it.skill, (bySkill.get(it.skill) ?? 0) + 1);

  for (const s of SKILLS) {
    const n = bySkill.get(s) ?? 0;
    const ok = n >= SKILL_FLOOR;
    const carriers = [...new Set(bank.items.filter((i) => i.skill === s).map((i) => i.taskType))];
    report.push(
      `    ${ok ? "✓" : "✗"} ${s.padEnd(10)} ${String(n).padStart(3)} / ${SKILL_FLOOR}` +
        `   (carried by ${carriers.length} task type${carriers.length === 1 ? "" : "s"}: ${
          carriers.join(", ") || "none"
        })`,
    );
    if (!ok) {
      findings.push({
        severity: "FAIL",
        code: "RULE7-SKILL-FLOOR",
        message: `${s} has ${n} items, below the hard floor of ${SKILL_FLOOR}.`,
      });
    }
    if (ok && carriers.length === 1) {
      findings.push({
        severity: "WARN",
        code: "SKILL-SINGLE-CARRIER",
        message:
          `${s} clears the floor on a single task type (${carriers[0]}). ` +
          `Retiring it drops the skill to 0 in one step — no gradual degrade.`,
      });
    }
  }

  // ---- REPORT: per task type (masterpiece target) ----
  report.push("");
  report.push(`  Masterpiece target (reported, not enforced): >= ${MASTERPIECE_PER_TYPE} per task type`);
  const types = [...new Set(bank.items.map((i) => i.taskType))].sort();
  for (const t of types) {
    const n = bank.items.filter((i) => i.taskType === t).length;
    report.push(
      `    ${n >= MASTERPIECE_PER_TYPE ? "✓" : "·"} ${t.padEnd(24)} ${String(n).padStart(3)} / ${MASTERPIECE_PER_TYPE}`,
    );
  }
  for (const t of bank.taskTypesWithNoItems) {
    report.push(`    ✗ ${t.padEnd(24)}   0 / ${MASTERPIECE_PER_TYPE}  (registry entry, no authored items)`);
  }

  // ---- REPORT: per task type x difficulty (depth for the adaptive engine) ----
  report.push("");
  report.push(`  Depth per task type x difficulty (target ~${MASTERPIECE_PER_CELL}+ per cell)`);
  report.push(`    ${"task type".padEnd(24)}${DIFFICULTIES.map((d) => d.slice(0, 4).padStart(8)).join("")}   total`);
  const thinCells: string[] = [];
  for (const t of types) {
    const cells = DIFFICULTIES.map(
      (d) => bank.items.filter((i) => i.taskType === t && i.difficulty === d).length,
    );
    const total = cells.reduce((a, b) => a + b, 0);
    report.push(
      `    ${t.padEnd(24)}${cells.map((c) => String(c).padStart(8)).join("")}   ${String(total).padStart(5)}`,
    );
    DIFFICULTIES.forEach((d, i) => {
      if (cells[i] < MASTERPIECE_PER_CELL) thinCells.push(`${t} / ${d}: ${cells[i]}`);
    });
  }
  if (thinCells.length > 0) {
    findings.push({
      severity: "WARN",
      code: "DEPTH-THIN-CELL",
      message: `${thinCells.length} task-type x difficulty cell(s) below the ~${MASTERPIECE_PER_CELL} masterpiece depth target.`,
      items: thinCells,
    });
  }

  // ---- REPORT: coverage against the 13 published DET question types ----
  report.push("");
  report.push(`  Coverage: ${types.length} task type(s) authored; registry declares ${bank.liveTaskTypes.length} live.`);

  report.push(`  Bank total: ${bank.items.length} items.`);

  return { findings, report };
});
