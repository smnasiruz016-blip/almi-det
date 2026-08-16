// gate:speaking-leak — do the spoken types hand over the rubric, or the question?
//
// ACTIVATED. This was a stub while Read Aloud was the only speaking type, because
// Read Aloud has nothing to hide: the sentence is the stimulus, on screen,
// because reading it aloud is the task. Three rubric-based types have now landed
// and there are two distinct things to withhold.
//
//   SL1 NO RUBRIC KEY   `rubric`, `reference` and `traits` must not appear as
//                       keys in any projection.
//   SL2 WHITELIST       every projection matches its exact field list.
//   SL3 NO RUBRIC VALUE the reference text must not reach the wire inside an
//                       allowed field either.
//   SL4 NO QUESTION     LISTEN_THEN_SPEAK must not emit `question` — by key OR
//                       by value. Its stimulus is AUDIO.
//   SL5 TRANSCRIPT NOTE every rubric-based spoken type carries the sentence
//                       saying the rating comes from a transcript, and
//                       SPEAKING_SAMPLE additionally carries the unscored note.
//
// SL4 IS THE ONE THIS TYPE EXISTS FOR. `question` is not an answer key — it is
// the LISTENING HALF OF THE TASK. Printing it beside the clip turns a
// listening-and-speaking item into a reading-and-speaking one, and nothing about
// the resulting recording would show that it had happened. A taker who never
// heard the audio would score the same as one who did.
//
// SL5 REQUIRES SOMETHING TO BE PRESENT, like gate:writing-leak's WL5, and for the
// same reason: these types rate a TRANSCRIPT and cannot hear the audio. If the
// sentence saying so is dropped in a redesign, nothing breaks and nothing fails —
// the product just quietly lets a learner read an accent verdict into a score
// that contains none.
//
// READ_ALOUD REMAINS EXEMPT and is asserted to be: its `text` is projected on
// purpose. That assertion is here so the exemption is a decision on record
// rather than a gap.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const RTS = "READ_THEN_SPEAK";
const LTS = "LISTEN_THEN_SPEAK";
const SS = "SPEAKING_SAMPLE";
const RA = "READ_ALOUD";
const IS = "INTERACTIVE_SPEAKING";

const ALLOWED: Record<string, readonly string[]> = {
  [RTS]: ["prompt", "speakSeconds", "transcriptNote"],
  [LTS]: ["audioUrl", "speakSeconds", "transcriptNote"],
  [SS]: ["category", "prompt", "speakSeconds", "transcriptNote", "practiceNote"],
  [RA]: ["text"],
  [IS]: ["stage", "topic", "register", "answered", "current", "transcriptNote"],
};

const FORBIDDEN_KEYS = ["rubric", "reference", "traits", "question"];
const MIN_SCANNABLE = 12;

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}

export default defineGate("gate:speaking-leak", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const types = [RTS, LTS, SS, RA, IS];
  const items = bank.items.filter((i) => types.includes(i.taskType));
  if (items.length === 0) {
    report.push("  no speaking items authored yet — nothing to check");
    return { findings, report };
  }

  const { toClientPayload } = await import("../../src/lib/det/client-payload");
  const { SPEAKING_TRANSCRIPT_NOTE } = await import("../../src/lib/det/tasks/speaking-rater");
  const { SPEAKING_SAMPLE_NOTE } = await import("../../src/lib/det/tasks/spoken-rubric");

  const forbidden: string[] = [];
  const shape: string[] = [];
  const values: string[] = [];
  const questionLeak: string[] = [];
  const missingNote: string[] = [];
  const staged: string[] = [];
  let projected = 0;

  for (const it of items) {
    const where = `${it.taskType} / ${it.title}`;
    let view: Record<string, unknown>;
    try {
      // No audio context: what a fresh attempt receives before any clip is
      // rendered. That is also the state in which a `question` leak would be
      // most tempting to add as a "fallback".
      view = toClientPayload(it.taskType as never, it.payload);
    } catch (e) {
      shape.push(`${where}: projection threw — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    projected++;
    const wire = JSON.stringify(view);
    const carried = collectStrings(view);

    // ---- SL1 forbidden keys ----
    for (const k of FORBIDDEN_KEYS) {
      if (new RegExp(`"${k}"\\s*:`).test(wire)) {
        forbidden.push(`${where}: "${k}" appears as a key in the projection`);
      }
    }

    // ---- SL2 whitelist ----
    const allowed = ALLOWED[it.taskType] ?? [];
    for (const k of Object.keys(view)) {
      if (!allowed.includes(k)) shape.push(`${where}: unexpected field "${k}" projected`);
    }

    // ---- SL3 rubric text by value ----
    const rubric = (it.payload.rubric ?? {}) as { reference?: unknown; traits?: unknown };
    if (typeof rubric.reference === "string" && rubric.reference.length >= MIN_SCANNABLE) {
      if (carried.some((c) => c.includes(rubric.reference as string))) {
        values.push(`${where}: rubric.reference reaches the client verbatim`);
      }
    }
    for (const t of (rubric.traits as string[] | undefined) ?? []) {
      if (t.length >= MIN_SCANNABLE && carried.some((c) => c.includes(t))) {
        values.push(`${where}: rubric trait "${t}" reaches the client`);
      }
    }

    // ---- SL4 the spoken question, by value as well as by key ----
    if (it.taskType === LTS) {
      const q = typeof it.payload.question === "string" ? it.payload.question : "";
      if (q.length >= MIN_SCANNABLE && carried.some((c) => c.includes(q))) {
        questionLeak.push(`${where}: the question TEXT is on the wire — the clip is meant to be the only copy`);
      }
      // Any string field long enough to be prose is suspicious on this view: the
      // only strings it should carry are a URL and the fixed transcript note.
      for (const [k, v] of Object.entries(view)) {
        if (typeof v !== "string" || v === SPEAKING_TRANSCRIPT_NOTE) continue;
        if (k === "audioUrl") continue;
        if (v.length >= MIN_SCANNABLE) {
          questionLeak.push(`${where}: unexpected prose in "${k}" — "${v.slice(0, 40)}…"`);
        }
      }
    }

    // ---- SL6 INTERACTIVE_SPEAKING: every turn, every stage ----
    //
    // One projection is not enough here. The view shows ONE turn, so checking
    // only the first would leave turns 2..N unexamined — and a leak on turn 3
    // is exactly as fatal as a leak on turn 1. Every stage is projected and
    // checked, and the released turn is asserted to be the one the progress
    // says, which is what proves the staged lock holds.
    if (it.taskType === IS) {
      const turns = (it.payload.turns as { question?: unknown }[] | undefined) ?? [];
      // A DISTINGUISHABLE URL PER SEGMENT. The first version of this check
      // asserted `current.index === i` and reported CLEAN when the projector was
      // sabotaged to always release turn 1 — because `index` is copied from
      // progress, so it agreed with itself. What has to be checked is WHICH CLIP
      // comes back, so the gate feeds a marker per seg and asserts the released
      // audio is the one for this turn.
      const audio = Object.fromEntries(turns.map((_, i) => [i, `seg-${i}`]));
      for (let i = 0; i < turns.length; i++) {
        let stageView: Record<string, unknown>;
        try {
          stageView = toClientPayload(IS as never, it.payload, {
            stored: { progress: { stage: "turn", turn: i } },
            audio,
          });
        } catch (e) {
          shape.push(`${where} / turn ${i + 1}: projection threw — ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        const stageStrings = collectStrings(stageView);
        const stageWire = JSON.stringify(stageView);
        for (const k of FORBIDDEN_KEYS) {
          if (new RegExp(`"${k}"\\s*:`).test(stageWire)) {
            forbidden.push(`${where} / turn ${i + 1}: "${k}" appears as a key`);
          }
        }
        // EVERY turn's question, checked against EVERY stage — a projection that
        // leaked turn 4's text while showing turn 1 would still be a leak.
        turns.forEach((t, j) => {
          const q = typeof t.question === "string" ? t.question : "";
          if (q.length >= MIN_SCANNABLE && stageStrings.some((c) => c.includes(q))) {
            questionLeak.push(
              `${where}: at turn ${i + 1} the wire carries the TEXT of turn ${j + 1}'s question`,
            );
          }
        });
        // THE STAGED LOCK, measured on the CLIP rather than on the index.
        const cur = stageView.current as { index?: number; audioUrl?: string | null } | null;
        if (!cur) {
          staged.push(`${where}: at progress turn ${i + 1} the view released nothing`);
        } else {
          if (cur.index !== i) {
            staged.push(
              `${where}: at progress turn ${i + 1} the view reports turn ${(cur.index ?? -1) + 1}`,
            );
          }
          if (cur.audioUrl !== `seg-${i}`) {
            staged.push(
              `${where}: at progress turn ${i + 1} the released CLIP is "${cur.audioUrl}", expected "seg-${i}" — ` +
                `a taker would hear the wrong question, or one they have not reached`,
            );
          }
        }
      }
      // And once the interview is done, nothing further is released.
      const doneView = toClientPayload(IS as never, it.payload, {
        stored: { progress: { stage: "done", turn: turns.length } },
      });
      if (doneView.current !== null) {
        staged.push(`${where}: a turn is still released after the interview is finished`);
      }
    }

    // ---- SL5 the notes that must be present ----
    if (it.taskType !== RA) {
      if (view.transcriptNote !== SPEAKING_TRANSCRIPT_NOTE) {
        missingNote.push(
          `${where}: transcriptNote is ${view.transcriptNote === undefined ? "absent" : "not the canonical sentence"}`,
        );
      }
    }
    if (it.taskType === SS && view.practiceNote !== SPEAKING_SAMPLE_NOTE) {
      missingNote.push(
        `${where}: practiceNote is ${view.practiceNote === undefined ? "absent" : "not the canonical sentence"}`,
      );
    }

    // ---- READ_ALOUD's exemption, asserted rather than assumed ----
    if (it.taskType === RA && typeof view.text !== "string") {
      shape.push(`${where}: READ_ALOUD must project its sentence — it IS the stimulus`);
    }
  }

  const count = (t: string) => items.filter((i) => i.taskType === t).length;
  report.push(
    `  ${RTS}: ${count(RTS)} · ${LTS}: ${count(LTS)} · ${SS}: ${count(SS)} · ${RA}: ${count(RA)} (exempt) — ${projected} projection(s)`,
  );
  report.push(`    SL1 no rubric/reference/traits/question key : ${forbidden.length === 0 ? "clean" : `${forbidden.length} leak(s)`}`);
  report.push(`    SL2 projections match the whitelist        : ${shape.length === 0 ? "clean" : `${shape.length} problem(s)`}`);
  report.push(`    SL3 rubric text not on the wire            : ${values.length === 0 ? "clean" : `${values.length} leak(s)`}`);
  report.push(`    SL4 LISTEN_THEN_SPEAK is audio only        : ${questionLeak.length === 0 ? "clean" : `${questionLeak.length} leak(s)`}`);
  report.push(`    SL5 transcript / practice notes present    : ${missingNote.length === 0 ? "clean" : `${missingNote.length} missing`}`);
  report.push(`    SL6 INTERACTIVE_SPEAKING staged lock       : ${staged.length === 0 ? "clean" : `${staged.length} problem(s)`}`);

  if (forbidden.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-LEAK-KEY",
      message:
        `A server-only field is present in a projection. \`rubric.reference\` is what the AI rater ` +
        `marks against; \`question\` is the listening half of Listen Then Speak.`,
      items: forbidden,
    });
  }
  if (shape.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-LEAK-SHAPE",
      message: `A projection emitted a field that is not on the whitelist.`,
      items: shape,
    });
  }
  if (values.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-LEAK-VALUE",
      message: `Rubric text crossed to the client inside an allowed field.`,
      items: values,
    });
  }
  if (questionLeak.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-QUESTION-VISIBLE",
      message:
        `Listen Then Speak's question is readable on the wire. The clip is meant to be the only copy: ` +
        `printing the text turns a listening-and-speaking item into a reading-and-speaking one, and ` +
        `nothing about the recording would show that it had happened.`,
      items: questionLeak,
    });
  }
  if (staged.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-STAGE-RELEASED-EARLY",
      message:
        `Interactive Speaking released the wrong turn. Turn n+1's clip must not exist on the wire ` +
        `until turn n is answered — otherwise someone can listen ahead, plan four answers and record ` +
        `them in order, and nothing in the recordings would show it happened.`,
      items: staged,
    });
  }
  if (missingNote.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-NOTE-MISSING",
      message:
        `A required on-screen note is not in the projected payload. These types rate a TRANSCRIPT and ` +
        `cannot hear the recording; dropping the sentence that says so breaks nothing visibly, which ` +
        `is exactly why it is checked.`,
      items: missingNote,
    });
  }

  return { findings, report };
});
