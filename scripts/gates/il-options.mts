// gate:il-options — the axes a multiple-choice REPLY set brings with it.
//
//   O1 WELL-FORMED   >= 3 options per turn, no two the same, `correct` in range,
//                    and 5-6 turns with exactly one opener sitting first.
//   O2 LENGTH TELL   the correct reply must not be the longest option. "Pick the
//                    longest answer" needs no English at all.
//   O3 POSITION      measured on the position the taker actually SEES, after the
//                    projection's permutation — not on the authored index.
//   O4 ROUND TRIP    a taker who picks the key ON SCREEN is marked correct, and
//                    one who picks a different position is not.
//
// O4 EXISTS BECAUSE EVERY OTHER CHECK HERE WOULD PASS ON AN INVERTED
// PERMUTATION. Projection and grading derive the same order independently; get
// the direction wrong in one of them and the options still look shuffled, the
// positions still look balanced, and every item is ungradable. So O4 does not
// re-implement the mapping — it drives the REAL scorer with the position the
// REAL projection displayed, which is the only pairing that can disagree. Note
// it feeds a response the projection produced, never the key itself: scoring a
// key against itself passes for any key ever written.
//
// O3 IS THE ONE WORTH READING TWICE. Options are authored with the key first,
// because that is how a conversation reads on the page. Checking the AUTHORED
// index would report "100% in position 1" on perfectly good content, and
// checking nothing would miss a permutation that does not actually move
// anything. So this gate calls the same turnOrder() the projector calls and
// counts where the key lands on screen. It measures the product, not the source.
//
// O2 DEVIATES FROM THE BRIEF, DELIBERATELY. A flat "the key is never the
// longest" rule installs the INVERSE tell: eliminate the longest of three and a
// guess goes from 1-in-3 to 1-in-2. So the length tell is measured as a RATE
// across the bank, the way gate:reading-set measures it, and the flat-zero case
// is reported as a warning once there are enough turns for zero to be a pattern
// rather than a small sample.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";
import { loadIL } from "./_il.mjs";

const MIN_OPTIONS = 3;
const MIN_TURNS = 5;
const MAX_TURNS = 6;
/** Fail when the key is the longest option this often. Chance with three
 *  options is 33%; 45% leaves room for honest variation. */
const LENGTH_TELL_FAIL = 0.45;
/** Fail when one displayed position holds this share of the keys. */
const POSITION_FAIL = 0.5;
/** Below this many turns, "the key is never the longest" is a small sample, not
 *  a pattern — do not warn about the inverse tell yet. */
const INVERSE_TELL_MIN_SAMPLE = 12;

export default defineGate("gate:il-options", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const il = await loadIL(bank);
  findings.push(...il.findings);

  if (il.total === 0) {
    report.push("  no INTERACTIVE_LISTENING items authored yet — nothing to check");
    return { findings, report };
  }

  const { turnOrder, scoreInteractiveListeningObjective } = await import(
    "../../src/lib/det/tasks/interactive-listening"
  );
  const { toClientPayload } = await import("../../src/lib/det/client-payload");

  const roundTrip: string[] = [];
  const malformed: string[] = [];
  const structure: string[] = [];
  const lengthTell: string[] = [];
  const positions: number[] = [];
  let longestCorrect = 0;
  let turnCount = 0;

  for (const { title, payload, item } of il.parsed) {
    // ---- O1 conversation structure ----
    if (payload.turns.length < MIN_TURNS || payload.turns.length > MAX_TURNS) {
      structure.push(
        `${title}: ${payload.turns.length} turn(s), rule is ${MIN_TURNS}-${MAX_TURNS}`,
      );
    }
    const openers = payload.turns.filter((t) => t.opener);
    if (openers.length !== 1) {
      structure.push(`${title}: ${openers.length} turn(s) marked opener, exactly 1 required`);
    } else if (!payload.turns[0].opener) {
      structure.push(
        `${title}: the opener is turn ${payload.turns.findIndex((t) => t.opener) + 1}, not turn 1 — ` +
          `an opener that is not first is a reply pretending to start the conversation`,
      );
    }

    payload.turns.forEach((t, i) => {
      const where = `${title} / turn ${i + 1}`;

      // ---- O1 options well-formed ----
      if (t.options.length < MIN_OPTIONS) {
        malformed.push(`${where}: ${t.options.length} option(s), floor is ${MIN_OPTIONS}`);
      }
      const norm = t.options.map((o) => o.trim().toLowerCase());
      if (new Set(norm).size !== norm.length) {
        malformed.push(`${where}: duplicate option text — two choices the taker cannot tell apart`);
      }
      if (t.correct < 0 || t.correct >= t.options.length) {
        malformed.push(
          `${where}: correct=${t.correct} is not an index into ${t.options.length} option(s) — ungradable`,
        );
        return; // nothing below can be measured on a broken key
      }

      turnCount++;

      // ---- O2 length tell ----
      const lens = t.options.map((o) => o.length);
      const max = Math.max(...lens);
      if (lens[t.correct] === max && lens.some((l) => l < max)) {
        longestCorrect++;
        lengthTell.push(`${where}: correct reply is the longest option (${max} chars)`);
      }

      // ---- O3 position, as DISPLAYED ----
      positions.push(turnOrder(payload, i).indexOf(t.correct));
    });

    // ---- O4 round trip through the real projection and the real scorer ----
    let shown: { options: string[] }[];
    try {
      shown = (toClientPayload("INTERACTIVE_LISTENING" as never, item.payload).turns ??
        []) as { options: string[] }[];
    } catch (e) {
      roundTrip.push(
        `${title}: projection threw, so no answer can be graded — ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    payload.turns.forEach((t, i) => {
      if (t.correct < 0 || t.correct >= t.options.length) return;
      const keyText = t.options[t.correct];
      // The position the key is displayed at, found IN THE PROJECTED OPTIONS —
      // the same way a taker finds it: by reading them.
      const displayed = (shown[i]?.options ?? []).indexOf(keyText);
      if (displayed < 0) {
        roundTrip.push(`${title} / turn ${i + 1}: the correct reply is not among the options shown`);
        return;
      }

      const pick = (pos: number) =>
        scoreInteractiveListeningObjective(payload, {
          filled: {},
          chosen: { [String(i)]: pos },
          summary: "",
        }).detail.turns[i].correct;

      if (!pick(displayed)) {
        roundTrip.push(
          `${title} / turn ${i + 1}: picking the correct reply where it is DISPLAYED (position ` +
            `${displayed + 1}) is marked wrong — the permutation does not invert`,
        );
      }
      const other = (displayed + 1) % (shown[i]?.options.length || 1);
      if (other !== displayed && pick(other)) {
        roundTrip.push(
          `${title} / turn ${i + 1}: picking a DIFFERENT option (position ${other + 1}) is also marked ` +
            `correct — the turn cannot distinguish a right answer from a wrong one`,
        );
      }
    });
  }

  report.push(`  INTERACTIVE_LISTENING: ${il.parsed.length} conversation(s), ${turnCount} gradable turn(s)`);
  report.push(`    O1 options well-formed        : ${malformed.length === 0 ? "clean" : `${malformed.length} problem(s)`}`);
  report.push(`    O1 conversation structure     : ${structure.length === 0 ? "clean" : `${structure.length} problem(s)`}`);

  if (malformed.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-OPTIONS-MALFORMED",
      message: `A turn's options are unusable or its key does not resolve.`,
      items: malformed,
    });
  }
  report.push(`    O4 answer round-trips         : ${roundTrip.length === 0 ? "clean" : `${roundTrip.length} problem(s)`}`);
  if (roundTrip.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-ANSWER-UNGRADABLE",
      message:
        `Choosing the correct reply where it is DISPLAYED does not score. Projection and grading derive ` +
        `the option permutation independently, so a direction error in either one leaves items that look ` +
        `perfect and cannot be answered.`,
      items: roundTrip,
    });
  }
  if (structure.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-TURN-STRUCTURE",
      message:
        `The conversation is not shaped like one. Interactive Listening runs ${MIN_TURNS}-${MAX_TURNS} turns ` +
        `with exactly one opener, first — the opener is the turn with no audio, where the taker chooses how to start.`,
      items: structure,
    });
  }

  // ---- O2 rate ----
  if (turnCount > 0) {
    const rate = longestCorrect / turnCount;
    report.push(
      `    O2 correct-is-longest         : ${longestCorrect}/${turnCount} (${Math.round(rate * 100)}%)`,
    );
    if (rate >= LENGTH_TELL_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "IL-LENGTH-TELL",
        message:
          `The correct reply is the longest option in ${Math.round(rate * 100)}% of turns. A taker who ` +
          `notices scores without listening — lengthen the distractors or shorten the key.`,
        items: lengthTell.slice(0, 12),
      });
    } else if (longestCorrect === 0 && turnCount >= INVERSE_TELL_MIN_SAMPLE) {
      findings.push({
        severity: "WARN",
        code: "IL-LENGTH-TELL-INVERSE",
        message:
          `The correct reply is NEVER the longest option across ${turnCount} turns. That is its own tell: ` +
          `eliminate the longest of three and a guess improves from 1-in-3 to 1-in-2. Let the key be ` +
          `longest occasionally.`,
      });
    }
  }

  // ---- O3 displayed position ----
  if (positions.length > 0) {
    const counts = new Map<number, number>();
    positions.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
    const ranked = [...counts].sort((a, b) => b[1] - a[1]);
    report.push(
      `    O3 key position AS DISPLAYED  : ${ranked
        .sort((a, b) => a[0] - b[0])
        .map(([p, c]) => `#${p + 1}→${c}`)
        .join(", ")}   (after the projector's permutation, not the authored index)`,
    );
    const [topPos, topCount] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (topCount / positions.length >= POSITION_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "IL-POSITION-BIAS",
        message:
          `${Math.round((topCount / positions.length) * 100)}% of correct replies are DISPLAYED in position ` +
          `${topPos + 1}. Measured after the permutation, so this is what the taker sees — and a taker who ` +
          `notices can score without listening.`,
      });
    }
  }

  return { findings, report };
});
