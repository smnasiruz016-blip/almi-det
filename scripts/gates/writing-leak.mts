// gate:writing-leak — do the rubric-based Writing types hand over the rubric?
//
// Both new Writing types carry `rubric.reference`: a prose description of what a
// strong answer does, which the AI rater marks against. That is an answer key
// wearing a different name — the same class of field as the photo tasks'
// `imageAlt`, which this repo already had to stop rendering as alt text. A taker
// who reads "opens with a clear thesis naming one skill, develops two reasons
// with concrete examples, closes with a forward-looking conclusion" has been
// handed the mark scheme.
//
//   WL1 NO RUBRIC KEY   `rubric`, `reference` and `traits` must not appear as
//                       keys in any projection.
//   WL2 WHITELIST       every projection matches its exact field list, so a
//                       field nobody has invented yet cannot ride along.
//   WL3 NO VALUE        the reference text must not reach the wire inside an
//                       allowed field either.
//   WL4 PROGRESSIVE     Interactive Writing's Part 2 prompt must be ABSENT from
//                       the wire before Part 1 is submitted — not hidden, absent.
//   WL5 NOTE PRESENT    Writing Sample must carry the practice note. This is the
//                       one check here that requires something to be there
//                       rather than gone, and it belongs in a leak gate because
//                       it is the same kind of promise: what the taker is told
//                       about what they are doing.
//
// WL5 EXISTS BECAUSE THE OMISSION IS SILENT. In the official DET the Writing
// Sample is sent to institutions UNSCORED. We rate it, which is right for a
// practice tool — but if the sentence saying so is dropped in a redesign,
// nothing breaks, no test fails, and the product quietly implies the real exam
// scores this. So the sentence lives in the projected payload and is checked
// here.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const IW = "INTERACTIVE_WRITING";
const WS = "WRITING_SAMPLE";

/** The exact key set each projection may carry. */
const ALLOWED = {
  iwRoot: ["stage", "topic", "register", "part1", "part2"],
  iwPart: ["key", "prompt", "minWords", "seconds", "text", "locked"],
  wsRoot: [
    "category",
    "topic",
    "prompt",
    "targetWords",
    "prepSeconds",
    "writeSeconds",
    "practiceNote",
  ],
} as const;

/** Never a key in any projection of these types. */
const FORBIDDEN_KEYS = ["rubric", "reference", "traits"];

/** Below this length a value scan collides with ordinary prose. */
const MIN_SCANNABLE = 12;

function extraKeys(obj: unknown, allowed: readonly string[]): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj as Record<string, unknown>).filter((k) => !allowed.includes(k));
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}

export default defineGate("gate:writing-leak", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const iwItems = bank.items.filter((i) => i.taskType === IW);
  const wsItems = bank.items.filter((i) => i.taskType === WS);
  if (iwItems.length === 0 && wsItems.length === 0) {
    report.push("  no INTERACTIVE_WRITING or WRITING_SAMPLE items authored yet — nothing to check");
    return { findings, report };
  }

  const { toClientPayload } = await import("../../src/lib/det/client-payload");
  const { interactiveWritingPayloadSchema } = await import(
    "../../src/lib/det/tasks/interactive-writing"
  );
  const { writingSamplePayloadSchema, WRITING_SAMPLE_NOTE } = await import(
    "../../src/lib/det/tasks/writing-sample"
  );

  const forbidden: string[] = [];
  const shape: string[] = [];
  const values: string[] = [];
  const early: string[] = [];
  const missingNote: string[] = [];
  const unparsable: string[] = [];
  let projections = 0;

  const scanKeys = (where: string, view: unknown): void => {
    const wire = JSON.stringify(view);
    for (const k of FORBIDDEN_KEYS) {
      if (new RegExp(`"${k}"\\s*:`).test(wire)) {
        forbidden.push(`${where}: "${k}" appears as a key in the projection`);
      }
    }
  };

  const scanValue = (where: string, view: unknown, secret: string, what: string): void => {
    if (secret.length < MIN_SCANNABLE) return;
    if (collectStrings(view).some((c) => c.includes(secret))) {
      values.push(`${where}: ${what} reaches the client verbatim`);
    }
  };

  // ---------------------------------------------------- INTERACTIVE_WRITING --
  for (const it of iwItems) {
    const parsed = interactiveWritingPayloadSchema.safeParse(it.payload);
    if (!parsed.success) {
      unparsable.push(
        `${IW} / ${it.title}: ${parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).slice(0, 3).join("; ")}`,
      );
      continue;
    }
    const p = parsed.data;

    // Stage 1 (fresh attempt) and Stage 2 (Part 1 recorded) are DIFFERENT wires.
    // Checking only one would miss half of what the taker ever receives.
    const stages: { where: string; view: Record<string, unknown> }[] = [];
    for (const [label, stored] of [
      ["Part 1 open", {}],
      ["Part 2 open", { progress: { stage: "2", turn: -1 }, text: { part1: "x" } }],
    ] as const) {
      try {
        stages.push({
          where: `${IW} / ${it.title} / ${label}`,
          view: toClientPayload(IW as never, it.payload, { stored }),
        });
      } catch (e) {
        shape.push(
          `${IW} / ${it.title} / ${label}: projection threw — ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    projections += stages.length;

    for (const { where, view } of stages) {
      scanKeys(where, view);
      scanValue(where, view, p.rubric.reference, "rubric.reference");
      for (const t of p.rubric.traits) scanValue(where, view, t, `rubric.traits "${t}"`);

      shape.push(...extraKeys(view, ALLOWED.iwRoot).map((k) => `${where} (root): unexpected field "${k}"`));
      shape.push(
        ...extraKeys(view.part1, ALLOWED.iwPart).map((k) => `${where} / part1: unexpected field "${k}"`),
      );
      if (view.part2) {
        shape.push(
          ...extraKeys(view.part2, ALLOWED.iwPart).map((k) => `${where} / part2: unexpected field "${k}"`),
        );
      }
    }

    // ---- WL4 progressive: Part 2's prompt must not exist before Part 1 ----
    const stage1 = stages.find((s) => s.where.endsWith("Part 1 open"));
    if (stage1) {
      if (stage1.view.part2 !== null && stage1.view.part2 !== undefined) {
        early.push(
          `${IW} / ${it.title}: "part2" is populated on a fresh attempt — the follow-up is released early`,
        );
      }
      if (
        p.part2.prompt.length >= MIN_SCANNABLE &&
        collectStrings(stage1.view).some((c) => c.includes(p.part2.prompt))
      ) {
        early.push(
          `${IW} / ${it.title}: Part 2's prompt is on the wire before Part 1 is submitted`,
        );
      }
    }
  }

  // -------------------------------------------------------- WRITING_SAMPLE --
  for (const it of wsItems) {
    const parsed = writingSamplePayloadSchema.safeParse(it.payload);
    if (!parsed.success) {
      unparsable.push(
        `${WS} / ${it.title}: ${parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).slice(0, 3).join("; ")}`,
      );
      continue;
    }
    const p = parsed.data;
    const where = `${WS} / ${it.title}`;
    let view: Record<string, unknown>;
    try {
      view = toClientPayload(WS as never, it.payload);
    } catch (e) {
      shape.push(`${where}: projection threw — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    projections++;

    scanKeys(where, view);
    scanValue(where, view, p.rubric.reference, "rubric.reference");
    for (const t of p.rubric.traits) scanValue(where, view, t, `rubric.traits "${t}"`);
    shape.push(...extraKeys(view, ALLOWED.wsRoot).map((k) => `${where}: unexpected field "${k}"`));

    // ---- WL5 the practice note must be there, verbatim ----
    if (view.practiceNote !== WRITING_SAMPLE_NOTE) {
      missingNote.push(
        `${where}: practiceNote is ${
          view.practiceNote === undefined ? "absent" : "not the canonical sentence"
        }`,
      );
    }
  }

  report.push(
    `  INTERACTIVE_WRITING: ${iwItems.length} item(s) · WRITING_SAMPLE: ${wsItems.length} item(s) · ${projections} projection(s) executed`,
  );
  report.push(`    WL1 no rubric/reference/traits key : ${forbidden.length === 0 ? "clean" : `${forbidden.length} leak(s)`}`);
  report.push(`    WL2 projections match whitelist    : ${shape.length === 0 ? "clean" : `${shape.length} problem(s)`}`);
  report.push(`    WL3 rubric text not on the wire    : ${values.length === 0 ? "clean" : `${values.length} leak(s)`}`);
  report.push(`    WL4 Part 2 withheld until Part 1   : ${early.length === 0 ? "clean" : `${early.length} problem(s)`}`);
  report.push(`    WL5 Writing Sample practice note   : ${missingNote.length === 0 ? "clean" : `${missingNote.length} missing`}`);

  if (unparsable.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-PAYLOAD-UNPARSABLE",
      message:
        `A Writing payload does not parse with the schema the submit route uses. It would be ` +
        `authored, seeded, then fail at grading time — reported here rather than skipped, because ` +
        `the checks below cannot see inside it.`,
      items: unparsable,
    });
  }
  if (forbidden.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-LEAK-RUBRIC-KEY",
      message:
        `The rubric is present in a client projection. \`rubric.reference\` is what the AI rater ` +
        `marks against — reading it is reading the mark scheme.`,
      items: forbidden,
    });
  }
  if (shape.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-LEAK-SHAPE",
      message:
        `A projection emitted a field that is not on the whitelist. Every field the browser gets ` +
        `has to be one someone decided it may have.`,
      items: shape,
    });
  }
  if (values.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-LEAK-VALUE",
      message: `Rubric text crossed to the client inside an allowed field.`,
      items: values,
    });
  }
  if (early.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-STAGE-RELEASED-EARLY",
      message:
        `Interactive Writing's Part 2 is on the wire before Part 1 is submitted. Part 2 asks the ` +
        `taker to argue the side they rejected and to mitigate the downside they themselves raised; ` +
        `someone who reads it first writes a Part 1 built to be easy to reverse, and the pair stops ` +
        `measuring anything.`,
      items: early,
    });
  }
  if (missingNote.length) {
    findings.push({
      severity: "FAIL",
      code: "WRITING-SAMPLE-NOTE-MISSING",
      message:
        `The Writing Sample practice note is not in the projected payload. In the official DET this ` +
        `sample is sent to institutions UNSCORED; we grade it for practice, and the taker has to be ` +
        `told that. Dropping the sentence breaks nothing visibly — which is exactly why it is checked.`,
      items: missingNote,
    });
  }

  return { findings, report };
});
