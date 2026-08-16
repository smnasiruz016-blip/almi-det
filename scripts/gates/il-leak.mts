// gate:il-leak — does Interactive Listening hand the taker the test?
//
// Five fields on an IL payload are server-only, and losing any ONE of them ends
// the task:
//
//   turn.line                what the audio says. Printed, there is no listening
//                            left — the taker reads the conversation.
//   turn.correct             the key.
//   summarize.reference      the AI rater's target, an answer key in prose.
//   summarize.keyPoints      the same key, itemised.
//   complete.text[].missing  the key for Part A.
//
// THIS TYPE ALSO WITHHOLDS BY TIME, so the gate has to check three projections,
// not one. Interactive Listening is delivered progressively: Stage A carries the
// gapped transcript, each turn is released only when it is reached, and the
// summary prompt arrives last. The turns never pass through toClientPayload() at
// all — a gate that only looked there would be blind to the half of the wire
// that actually carries the conversation.
//
//   IL-L1  no forbidden key in ANY of the three projections
//   IL-L2  every projection matches its field whitelist
//   IL-L3  no long-form server-only VALUE reaches any projection
//   IL-L4  a turn's options cross intact, only re-ordered
//   IL-L5  Stage A carries no later option text and no summary prompt
//   IL-L6  a turn view carries that turn's options and no other turn's
//
// HOW IL-L1/L2 ARE CHECKED, AND WHY NOT BY SCANNING THE WIRE FOR KEYS.
//
// A substring scan for the Part A keys is the obvious implementation and it is
// wrong here, in both directions:
//
//   FALSE POSITIVE. The blanked word "library" appears legitimately inside a
//   turn option ("The library usually closes at five-thirty"). Topic words recur
//   across a conversation because it is ONE conversation — that is what makes it
//   coherent. A scan for the key would fire on correct, shipped content, and a
//   gate that cries wolf is a gate someone switches off.
//
//   FALSE NEGATIVE. `turn.correct` is a small integer. Scanning for "0" proves
//   nothing at all.
//
// The real protection for Part A is not that its words never recur — it is that
// the ANSWERS are hidden and Stage A is LOCKED before any later option is
// released. IL-L5 is what proves the second half of that.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";
import { loadIL, IL_TASK_TYPE, collectStrings } from "./_il.mjs";

/** The exact key set the browser may receive, level by level. */
const ALLOWED = {
  root: ["stage", "scenario", "complete", "current"],
  scenario: ["register", "setting", "speakerName", "youAre"],
  complete: ["audioUrl", "text", "filled", "locked"],
  textChunk: ["kind", "text"],
  blankChunk: ["kind", "id"],
  turn: ["kind", "index", "total", "opener", "audioUrl", "options"],
  summarize: ["kind", "prompt", "seconds"],
} as const;

/** Field names that must never appear as a key in any projection. */
const FORBIDDEN_KEYS = ["line", "correct", "reference", "keyPoints", "missing"];

/** Value scans are pointless below this length — short strings collide with
 *  ordinary prose. Same threshold gate:leak uses for imageAlt. */
const MIN_SCANNABLE = 12;

function extraKeys(obj: unknown, allowed: readonly string[]): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj as Record<string, unknown>).filter((k) => !allowed.includes(k));
}

export default defineGate("gate:il-leak", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const il = await loadIL(bank);
  findings.push(...il.findings);

  if (il.total === 0) {
    report.push("  no INTERACTIVE_LISTENING items authored yet — nothing to check");
    return { findings, report };
  }

  const { toClientPayload } = await import("../../src/lib/det/client-payload");
  const { projectILTurn, projectILSummarize } = await import("../../src/lib/det/il-stages");

  const shape: string[] = [];
  const forbidden: string[] = [];
  const values: string[] = [];
  const optionLoss: string[] = [];
  const earlyRelease: string[] = [];
  let projections = 0;

  for (const { title, payload, item } of il.parsed) {
    // ---- the three projections, exactly as the runtime builds them ----
    let stageA: Record<string, unknown>;
    try {
      // No audio and no stored progress: what a fresh attempt receives.
      stageA = toClientPayload(IL_TASK_TYPE as never, item.payload);
    } catch (e) {
      shape.push(`${title}: Stage A projection threw — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const turnViews = payload.turns.map((_, i) => projectILTurn(payload, i));
    const summarizeView = projectILSummarize(payload);

    const named: { where: string; view: unknown }[] = [
      { where: "Stage A", view: stageA },
      ...turnViews.map((v, i) => ({ where: `turn ${i + 1}`, view: v })),
      { where: "summarize", view: summarizeView },
    ];
    projections += named.length;

    for (const { where, view } of named) {
      const wire = JSON.stringify(view);

      // ---- IL-L1 forbidden keys ----
      for (const k of FORBIDDEN_KEYS) {
        if (new RegExp(`"${k}"\\s*:`).test(wire)) {
          forbidden.push(`${title} / ${where}: "${k}" appears as a key in the projection`);
        }
      }

      // ---- IL-L3 long-form secrets, by value ----
      const secrets: { what: string; text: string }[] = [
        { what: "summarize.reference", text: payload.summarize.reference },
        ...payload.summarize.keyPoints.map((k, i) => ({ what: `summarize.keyPoints[${i}]`, text: k })),
        ...payload.turns
          .map((t, i) => ({ what: `turns[${i}].line`, text: t.line ?? "" }))
          .filter((s) => s.text),
      ];
      const carried = collectStrings(view);
      for (const s of secrets) {
        if (s.text.length < MIN_SCANNABLE) continue;
        if (carried.some((c) => c.includes(s.text))) {
          values.push(`${title} / ${where} / ${s.what}: value reaches the client verbatim`);
        }
      }
    }

    // ---- IL-L2 shape whitelist ----
    const note = (where: string, extras: string[]): void => {
      for (const k of extras) shape.push(`${title} / ${where}: unexpected field "${k}" projected`);
    };
    note("Stage A (root)", extraKeys(stageA, ALLOWED.root));
    note("Stage A / scenario", extraKeys(stageA.scenario, ALLOWED.scenario));
    note("Stage A / complete", extraKeys(stageA.complete, ALLOWED.complete));
    const chunks = ((stageA.complete as Record<string, unknown>)?.text ?? []) as Record<
      string,
      unknown
    >[];
    chunks.forEach((c, i) => {
      const allowed = c.kind === "blank" ? ALLOWED.blankChunk : ALLOWED.textChunk;
      note(`Stage A / complete.text[${i}]`, extraKeys(c, allowed));
    });
    turnViews.forEach((v, i) => note(`turn ${i + 1}`, extraKeys(v, ALLOWED.turn)));
    note("summarize", extraKeys(summarizeView, ALLOWED.summarize));

    // ---- IL-L4 options cross INTACT, only re-ordered ----
    // Withholding is only half the contract. A projection that dropped or
    // rewrote an option would leave the taker choosing among a set the grader
    // does not know about — and every check above would still pass.
    payload.turns.forEach((t, i) => {
      const shown = turnViews[i]?.options ?? [];
      const a = [...t.options].sort();
      const b = [...shown].sort();
      if (a.length !== b.length || a.some((x, j) => x !== b[j])) {
        optionLoss.push(
          `${title} / turn ${i + 1}: projected options are not a permutation of the authored ones ` +
            `(${t.options.length} authored, ${shown.length} projected)`,
        );
      }
    });

    // ---- IL-L5 Stage A carries nothing from later stages ----
    // THE PROGRESSIVE-DELIVERY PROPERTY. Every reply option and the summary
    // prompt must be absent from the first payload — not merely unrendered.
    const stageAStrings = collectStrings(stageA);
    const later: { what: string; text: string }[] = [
      ...payload.turns.flatMap((t, i) =>
        t.options.map((o, j) => ({ what: `turns[${i}].options[${j}]`, text: o })),
      ),
      { what: "summarize.prompt", text: payload.summarize.prompt },
    ];
    for (const l of later) {
      if (l.text.length < MIN_SCANNABLE) continue;
      if (stageAStrings.some((c) => c.includes(l.text))) {
        earlyRelease.push(
          `${title} / Stage A: ${l.what} is already on the wire before Part 1 is submitted`,
        );
      }
    }
    // Stage A must also carry no audio URL for any turn.
    if (stageA.current !== null && stageA.current !== undefined) {
      earlyRelease.push(
        `${title} / Stage A: "current" is populated on a fresh attempt — a later stage is released early`,
      );
    }

    // ---- IL-L6 a turn view is THAT turn only ----
    turnViews.forEach((v, i) => {
      if (!v) return;
      const mine = new Set(payload.turns[i].options);
      const strings = collectStrings(v);
      payload.turns.forEach((other, j) => {
        if (j === i) return;
        for (const o of other.options) {
          if (o.length < MIN_SCANNABLE || mine.has(o)) continue;
          if (strings.some((c) => c.includes(o))) {
            earlyRelease.push(
              `${title} / turn ${i + 1}: carries an option belonging to turn ${j + 1}`,
            );
          }
        }
      });
    });
  }

  report.push(
    `  INTERACTIVE_LISTENING: ${il.parsed.length}/${il.total} payload(s) parsed, ${projections} stage projection(s) executed`,
  );
  report.push(`    IL-L1 no key named line/correct/reference/keyPoints/missing : ${forbidden.length === 0 ? "clean" : `${forbidden.length} leak(s)`}`);
  report.push(`    IL-L2 every projection matches its field whitelist         : ${shape.length === 0 ? "clean" : `${shape.length} problem(s)`}`);
  report.push(`    IL-L3 no server-only value reaches the wire                : ${values.length === 0 ? "clean" : `${values.length} leak(s)`}`);
  report.push(`    IL-L4 options cross intact, only re-ordered                : ${optionLoss.length === 0 ? "clean" : `${optionLoss.length} problem(s)`}`);
  report.push(`    IL-L5/L6 nothing released before its stage                 : ${earlyRelease.length === 0 ? "clean" : `${earlyRelease.length} problem(s)`}`);

  if (forbidden.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-LEAK-KEY-FIELD",
      message:
        `A server-only field is present in a projection. turn.line IS the listening test, ` +
        `turn.correct and complete.text[].missing are answer keys, and summarize.reference / ` +
        `keyPoints are what the AI rater marks against.`,
      items: forbidden,
    });
  }
  if (shape.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-LEAK-SHAPE",
      message:
        `A projection emitted a field that is not on the whitelist. Every field the browser gets ` +
        `has to be one someone decided it may have — an unexpected field is either a new leak or a ` +
        `whitelist nobody updated.`,
      items: shape,
    });
  }
  if (values.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-LEAK-VALUE",
      message: `A server-only value crossed to the client inside an allowed field.`,
      items: values,
    });
  }
  if (optionLoss.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-OPTIONS-NOT-PERMUTED",
      message:
        `The projected options are not a permutation of the authored ones. The taker would be ` +
        `choosing from a set the grader never sees, so a correct answer could be unreachable.`,
      items: optionLoss,
    });
  }
  if (earlyRelease.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-STAGE-RELEASED-EARLY",
      message:
        `Content from a later stage is on the wire before its stage is reached. Progressive ` +
        `delivery is what makes the Part 1 lock real: if the reply options are already in the ` +
        `first payload, several of them name the words that were blanked, and Part 1 becomes a ` +
        `search through the payload rather than a listening task.`,
      items: earlyRelease,
    });
  }

  return { findings, report };
});
