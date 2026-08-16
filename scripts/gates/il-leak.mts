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
// HOW THIS IS CHECKED, AND WHY NOT BY SCANNING THE WIRE.
//
// A substring scan over the projected JSON is the obvious implementation and it
// is wrong here, in both directions:
//
//   FALSE POSITIVE. The blanked word "library" appears legitimately inside a
//   turn option ("The library usually closes at five-thirty"). A wire scan for
//   the key would fire on correct, shipped content — and gate:leak's own history
//   in this repo is that a gate which cries wolf gets switched off.
//
//   FALSE NEGATIVE. `turn.correct` is a small integer. Scanning the wire for "0"
//   proves nothing at all.
//
// So the check is a SHAPE WHITELIST: the projected object's key set is compared,
// level by level, against the exact set someone decided the browser may have.
// Any key not on that list is a finding, including a key nobody has invented
// yet — which is the point. Long-form secrets (line, reference, keyPoints) get
// an additional value scan on top, because those could in principle be copied
// into an allowed field like an option's text.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";
import { loadIL, IL_TASK_TYPE, collectStrings } from "./_il.mjs";

/** The exact key set the browser may receive, level by level. */
const ALLOWED = {
  root: ["scenario", "complete", "turns", "summarize"],
  scenario: ["register", "setting", "speakerName", "youAre"],
  complete: ["audioUrl", "text"],
  textChunk: ["kind", "text"],
  blankChunk: ["kind", "id"],
  turn: ["index", "opener", "audioUrl", "options"],
  summarize: ["prompt"],
} as const;

/** Field names that must never appear as a key anywhere in the projection. */
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

  const shape: string[] = [];
  const forbidden: string[] = [];
  const values: string[] = [];
  const optionLoss: string[] = [];
  let projected = 0;

  for (const { title, payload, item } of il.parsed) {
    let client: Record<string, unknown>;
    try {
      // Deliberately projected WITHOUT an audio context, the way a gate must:
      // audioUrl is DB-only and a content gate has no database. What crosses
      // here is therefore the payload-derived part of the wire — which is the
      // part that could carry a key.
      client = toClientPayload(IL_TASK_TYPE as never, item.payload);
    } catch (e) {
      shape.push(`${title}: projection threw — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    projected++;
    const wire = JSON.stringify(client);

    // ---- IL-L1: no forbidden key anywhere in the projection ----
    for (const k of FORBIDDEN_KEYS) {
      if (new RegExp(`"${k}"\\s*:`).test(wire)) {
        forbidden.push(`${title}: "${k}" appears as a key in the client payload`);
      }
    }

    // ---- IL-L2: shape whitelist, level by level ----
    const note = (where: string, extras: string[]): void => {
      for (const k of extras) shape.push(`${title} / ${where}: unexpected field "${k}" projected`);
    };
    note("(root)", extraKeys(client, ALLOWED.root));
    note("scenario", extraKeys(client.scenario, ALLOWED.scenario));
    note("complete", extraKeys(client.complete, ALLOWED.complete));
    note("summarize", extraKeys(client.summarize, ALLOWED.summarize));

    const chunks = ((client.complete as Record<string, unknown>)?.text ?? []) as Record<
      string,
      unknown
    >[];
    chunks.forEach((c, i) => {
      const allowed = c.kind === "blank" ? ALLOWED.blankChunk : ALLOWED.textChunk;
      note(`complete.text[${i}]`, extraKeys(c, allowed));
    });

    const turns = (client.turns ?? []) as Record<string, unknown>[];
    turns.forEach((t, i) => note(`turns[${i}]`, extraKeys(t, ALLOWED.turn)));

    // ---- IL-L3: long-form secrets must not reach the wire by value ----
    const secrets: { what: string; text: string }[] = [
      { what: "summarize.reference", text: payload.summarize.reference },
      ...payload.summarize.keyPoints.map((k, i) => ({ what: `summarize.keyPoints[${i}]`, text: k })),
      ...payload.turns
        .map((t, i) => ({ what: `turns[${i}].line`, text: t.line ?? "" }))
        .filter((s) => s.text),
    ];
    const carried = collectStrings(client);
    for (const s of secrets) {
      if (s.text.length < MIN_SCANNABLE) continue;
      if (wire.includes(s.text) || carried.some((c) => c.includes(s.text))) {
        values.push(`${title} / ${s.what}: value reaches the client verbatim`);
      }
    }

    // ---- IL-L4: the options must cross INTACT, only re-ordered ----
    // Withholding is only half the contract. A projection that dropped or
    // rewrote an option would leave the taker choosing among a set the grader
    // does not know about — and every check above would still pass.
    payload.turns.forEach((t, i) => {
      const shown = (turns[i]?.options ?? []) as string[];
      const a = [...t.options].sort();
      const b = [...shown].sort();
      if (a.length !== b.length || a.some((x, j) => x !== b[j])) {
        optionLoss.push(
          `${title} / turn ${i + 1}: projected options are not a permutation of the authored ones ` +
            `(${t.options.length} authored, ${shown.length} projected)`,
        );
      }
    });
  }

  report.push(`  INTERACTIVE_LISTENING: ${il.parsed.length}/${il.total} payload(s) parsed, ${projected} projected`);
  report.push(`    IL-L1 no key named line/correct/reference/keyPoints/missing : ${forbidden.length === 0 ? "clean" : `${forbidden.length} leak(s)`}`);
  report.push(`    IL-L2 projection matches the field whitelist               : ${shape.length === 0 ? "clean" : `${shape.length} problem(s)`}`);
  report.push(`    IL-L3 no server-only value reaches the wire                : ${values.length === 0 ? "clean" : `${values.length} leak(s)`}`);
  report.push(`    IL-L4 options cross intact, only re-ordered                : ${optionLoss.length === 0 ? "clean" : `${optionLoss.length} problem(s)`}`);

  if (forbidden.length) {
    findings.push({
      severity: "FAIL",
      code: "IL-LEAK-KEY-FIELD",
      message:
        `A server-only field is present in the client payload. turn.line IS the listening test, ` +
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
        `The projection emitted a field that is not on the whitelist. Every field the browser gets ` +
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

  return { findings, report };
});
