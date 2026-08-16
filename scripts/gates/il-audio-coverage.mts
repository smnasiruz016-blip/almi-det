// gate:il-audio-coverage — will the clips this conversation asks for actually
// exist?
//
// Interactive Listening is the first task type that needs SEVERAL clips per
// item, and the payload names them by label ("scenario", "turn-3") while
// DetItemAudio keys on an integer. Between the two sits
// scripts/generate-det-audio.mts, which decides what gets rendered. Nothing
// before production checked that the two agree.
//
//   C1 LABELS VALID    every referenced label maps to a DetItemAudio seg.
//   C2 NO MISSING CLIP every referenced segment is one the generator manifest
//                      would produce.
//   C3 NO ORPHAN CLIP  every unit the manifest produces is referenced by the
//                      payload — a clip rendered and paid for that nothing plays.
//   C4 SEG UNIQUE      no two segments of one item share a number; DetItemAudio
//                      is unique on (itemId, seg), so a collision means the
//                      second upload silently overwrites the first and the
//                      conversation plays one clip twice.
//   C5 SEG MATCHES     "turn-N" must name the turn it is on. A label pointing at
//                      a different turn renders fine and plays the wrong line.
//   C6 OPENER SHAPE    exactly the opener has no seg and no line; every other
//                      turn has both.
//
// The manifest is read through src/lib/det/audio-units.ts, the same function the
// generator loops over — not a re-description of it. A gate that models what the
// generator "probably does" tests the model, not the generator.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";
import { loadIL, IL_TASK_TYPE } from "./_il.mjs";

export default defineGate("gate:il-audio-coverage", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const il = await loadIL(bank);
  findings.push(...il.findings);

  if (il.total === 0) {
    report.push("  no INTERACTIVE_LISTENING items authored yet — nothing to check");
    return { findings, report };
  }

  const { audioUnitsForItem } = await import("../../src/lib/det/audio-units");
  const { isValidSegLabel, segLabelToNumber } = await import(
    "../../src/lib/det/tasks/interactive-listening"
  );

  const badLabel: string[] = [];
  const missingClip: string[] = [];
  const orphanClip: string[] = [];
  const segCollision: string[] = [];
  const segMismatch: string[] = [];
  const openerShape: string[] = [];
  let referenced = 0;
  let produced = 0;

  for (const { title, payload, item } of il.parsed) {
    // ---- what the payload REFERENCES ----
    const refs: { label: string; where: string }[] = [
      { label: payload.complete.seg, where: "complete" },
    ];
    payload.turns.forEach((t, i) => {
      const where = `turn ${i + 1}`;

      // ---- C6 opener shape ----
      if (t.opener) {
        if (t.seg !== null) {
          openerShape.push(`${title} / ${where}: opener carries seg "${t.seg}" — the opener has no audio`);
        }
        if (t.line !== null) {
          openerShape.push(
            `${title} / ${where}: opener carries a line — there is nothing to hear before the taker starts`,
          );
        }
      } else {
        if (t.seg === null) {
          openerShape.push(
            `${title} / ${where}: no seg, but only the opener may be silent — this turn would have no audio`,
          );
        }
        if (!t.line || !t.line.trim()) {
          openerShape.push(
            `${title} / ${where}: no line to speak, so its clip would be empty and the turn would play nothing`,
          );
        }
      }

      if (t.seg === null) return;
      refs.push({ label: t.seg, where });

      // ---- C5 the label must name the turn it is on ----
      const m = /^turn-(\d+)$/.exec(t.seg);
      if (m && Number.parseInt(m[1], 10) !== i + 1) {
        segMismatch.push(
          `${title} / ${where}: labelled "${t.seg}" — a label that names a different turn renders ` +
            `fine and plays the wrong line`,
        );
      }
    });
    referenced += refs.length;

    // ---- C1 labels valid ----
    const usable = refs.filter((r) => {
      if (isValidSegLabel(r.label)) return true;
      badLabel.push(
        `${title} / ${r.where}: seg "${r.label}" is not a segment label — expected "scenario" or "turn-N"`,
      );
      return false;
    });

    // ---- C4 seg numbers unique within the item ----
    const byNumber = new Map<number, string[]>();
    for (const r of usable) {
      const n = segLabelToNumber(r.label);
      byNumber.set(n, [...(byNumber.get(n) ?? []), `${r.where} ("${r.label}")`]);
    }
    for (const [n, wheres] of byNumber) {
      if (wheres.length > 1) {
        segCollision.push(
          `${title}: seg ${n} is claimed by ${wheres.join(" and ")} — DetItemAudio is unique on ` +
            `(itemId, seg), so the second clip would overwrite the first`,
        );
      }
    }

    // ---- C2 / C3 against the REAL manifest ----
    const units = audioUnitsForItem(IL_TASK_TYPE, item.payload);
    produced += units.length;
    const producible = new Set(units.map((u) => u.seg));
    const referencedNums = new Set([...byNumber.keys()]);

    for (const [n, wheres] of byNumber) {
      if (!producible.has(n)) {
        missingClip.push(
          `${title}: ${wheres.join(", ")} needs seg ${n}, which the audio manifest would not render — ` +
            `the item would ship with a silent gap`,
        );
      }
    }
    for (const u of units) {
      if (!referencedNums.has(u.seg)) {
        orphanClip.push(
          `${title}: the manifest would render seg ${u.seg} ("${u.label}") that no part of the payload plays — ` +
            `a clip rendered and paid for that nothing reaches`,
        );
      }
    }
  }

  report.push(
    `  INTERACTIVE_LISTENING: ${il.parsed.length} conversation(s), ${referenced} segment(s) referenced, ${produced} unit(s) the manifest would render`,
  );
  report.push(`    C1 segment labels valid       : ${badLabel.length === 0 ? "clean" : `${badLabel.length} problem(s)`}`);
  report.push(`    C2 no missing clip            : ${missingClip.length === 0 ? "clean" : `${missingClip.length} problem(s)`}`);
  report.push(`    C3 no orphan clip             : ${orphanClip.length === 0 ? "clean" : `${orphanClip.length} problem(s)`}`);
  report.push(`    C4 seg numbers unique per item: ${segCollision.length === 0 ? "clean" : `${segCollision.length} collision(s)`}`);
  report.push(`    C5 turn-N names its own turn  : ${segMismatch.length === 0 ? "clean" : `${segMismatch.length} problem(s)`}`);
  report.push(`    C6 opener silent, others heard: ${openerShape.length === 0 ? "clean" : `${openerShape.length} problem(s)`}`);

  if (badLabel.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-AUDIO-BAD-LABEL",
      message: `A segment label does not map to a DetItemAudio seg, so its clip can never be stored.`,
      items: badLabel,
    });
  }
  if (missingClip.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-AUDIO-MISSING-CLIP",
      message:
        `The payload plays a segment the audio generator would never render. The item looks complete in ` +
        `the seed and ships with a hole where a clip should be.`,
      items: missingClip,
    });
  }
  if (orphanClip.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-AUDIO-ORPHAN-CLIP",
      message: `The generator would render a clip nothing in the payload plays — rendered, paid for, unreachable.`,
      items: orphanClip,
    });
  }
  if (segCollision.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-AUDIO-SEG-COLLISION",
      message: `Two segments of one item share a seg number, so one clip would overwrite the other.`,
      items: segCollision,
    });
  }
  if (segMismatch.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-AUDIO-SEG-MISMATCH",
      message: `A "turn-N" label does not name the turn it sits on — the turn would play another turn's line.`,
      items: segMismatch,
    });
  }
  if (openerShape.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-AUDIO-OPENER-SHAPE",
      message:
        `Exactly the opener may be silent. It is the turn where the taker chooses how to START the ` +
        `conversation, so it has no seg and no line; every other turn must have both or it plays nothing.`,
      items: openerShape,
    });
  }

  return { findings, report };
});
