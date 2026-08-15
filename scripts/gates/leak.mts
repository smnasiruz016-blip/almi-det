// gate:leak — does the answer reach the test-taker before they answer?
//
// Three surfaces, because a key can escape through any of them:
//   1. The item's own visible prose (title / prompt / guidanceNote).
//   2. The payload the server ships to the browser.
//   3. The text the AI rater is told to judge against.
//
// Surface 3 is the one a text-only leak check misses. For the photo tasks the
// AI rater judges the response against `payload.imageAlt` — and the composer
// renders that same string as the <img alt>. Anyone who reads the DOM (or uses
// a screen reader) is handed the exact sentence the grader compares to.
//
// Matching is word-boundary and length-gated: a gate that flags "the" gets
// switched off within a week.

import { readFileSync } from "node:fs";
import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const SESSION_PAGE = "src/app/(app)/practice/session/[sessionId]/page.tsx";
const WRITE_TASK = "src/lib/det/tasks/write-about-the-photo.ts";
const SPEAK_TASK = "src/lib/det/tasks/speak-about-the-photo.ts";
const WRITE_COMPOSER = "src/components/det/WriteAboutPhotoComposer.tsx";
const SPEAK_COMPOSER = "src/components/det/SpeakAboutPhotoComposer.tsx";

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function read(p: string): string {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export default defineGate("gate:leak", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const stemOf = (i: { title: string; prompt: string; guidanceNote: string | null }) =>
    norm([i.title, i.prompt, i.guidanceNote ?? ""].join(" "));

  // ---- L1: LISTEN_AND_TYPE — the sentence IS the key; it must not be in the stem ----
  const listen = bank.items.filter((i) => i.taskType === "LISTEN_AND_TYPE");
  const l1: string[] = [];
  const l1b: string[] = [];
  for (const it of listen) {
    const sentence = String(it.payload.sentence ?? "");
    const key = norm(sentence);
    const stem = stemOf(it);
    if (key && stem.includes(key)) {
      l1.push(`${it.title}: full sentence present in visible prose`);
      continue;
    }
    // Partial: >=60% of the key's content words (len>=4) visible in the stem.
    const content = [...new Set(key.split(" ").filter((w) => w.length >= 4))];
    if (content.length >= 3) {
      const hit = content.filter((w) => new RegExp(`\\b${w}\\b`).test(stem));
      if (hit.length / content.length >= 0.6) {
        l1.push(`${it.title}: ${hit.length}/${content.length} key content words visible (${hit.join(", ")})`);
      }
    }
    // audioScript must not diverge from the key, or the item is unanswerable.
    const script = it.payload.audioScript;
    if (typeof script === "string" && norm(script) !== key) {
      l1b.push(`${it.title}: audioScript differs from the scored sentence`);
    }
  }
  report.push(`  L1 LISTEN_AND_TYPE key-in-stem: ${listen.length} item(s) checked, ${l1.length} leaking`);
  if (l1.length) findings.push({ severity: "FAIL", code: "LEAK-KEY-IN-STEM", message: "Scored sentence visible in the item's own prose.", items: l1 });
  if (l1b.length) findings.push({ severity: "FAIL", code: "AUDIO-KEY-MISMATCH", message: "audioScript diverges from the scored sentence — item is unanswerable as spoken.", items: l1b });

  // ---- L2: READ_AND_SELECT — no candidate word may appear in visible prose ----
  const ras = bank.items.filter((i) => i.taskType === "READ_AND_SELECT");
  const l2: string[] = [];
  for (const it of ras) {
    const words = (it.payload.words as { text: string; real: boolean }[] | undefined) ?? [];
    const stem = stemOf(it);
    for (const w of words) {
      if (w.text.length < 4) continue;
      if (new RegExp(`\\b${norm(w.text)}\\b`).test(stem)) {
        l2.push(`${it.title}: candidate "${w.text}" (real=${w.real}) appears in visible prose`);
      }
    }
  }
  report.push(`  L2 READ_AND_SELECT candidate-in-stem: ${ras.length} item(s) checked, ${l2.length} leaking`);
  if (l2.length) findings.push({ severity: "FAIL", code: "LEAK-CANDIDATE-IN-STEM", message: "A candidate word appears in the item's visible prose, revealing its status.", items: l2 });

  // ---- L3: EXECUTE the client projection and inspect what it actually emits ----
  //
  // This is deliberately behavioural, not a source grep. Reading the source for
  // `alt={imageAlt}` only ever proved something about one render site; running
  // toClientPayload() over every real item proves what the browser receives.
  const { toClientPayload, projectedTaskTypes } = await import("../../src/lib/det/client-payload");

  // The field on each task's stored payload that must never cross to the client,
  // and why it is an answer key rather than decoration.
  const SERVER_ONLY: Record<string, string> = {
    LISTEN_AND_TYPE: "sentence",
    WRITE_ABOUT_THE_PHOTO: "imageAlt",
    SPEAK_ABOUT_THE_PHOTO: "imageAlt",
  };

  const l3: string[] = [];
  let projected = 0;
  for (const it of bank.items) {
    let client: Record<string, unknown>;
    try {
      client = toClientPayload(it.taskType as never, it.payload);
    } catch (e) {
      l3.push(`${it.taskType} / ${it.title}: projection threw — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    projected++;
    const wire = JSON.stringify(client);

    // Named server-only field must be absent, by key AND by value.
    const field = SERVER_ONLY[it.taskType];
    if (field) {
      const secret = it.payload[field];
      if (field in client) l3.push(`${it.taskType} / ${it.title}: "${field}" present in the client payload`);
      if (typeof secret === "string" && secret.length > 12 && wire.includes(secret)) {
        l3.push(`${it.taskType} / ${it.title}: value of "${field}" reaches the client verbatim`);
      }
    }
    // READ_AND_SELECT: the boolean key must not survive projection.
    if (it.taskType === "READ_AND_SELECT" && /"real"\s*:/.test(wire)) {
      l3.push(`${it.taskType} / ${it.title}: word "real" flags present in the client payload`);
    }
    // READ_AND_COMPLETE: neither the keyed letters nor the alternatives may
    // survive projection — only the blank LENGTH is allowed across.
    //
    // Checked against the projected BLANK TOKENS, not against the whole wire.
    // A raw substring scan looks stricter but is worse: a key like "ther"
    // (weather -> wea|ther) occurs inside ordinary passage prose — "there is
    // very" — so the scan fired on two clean items. A gate that cries wolf on
    // correct content is a gate someone switches off, and the structured check
    // below is both exact and immune to what the passage happens to say.
    if (it.taskType === "READ_AND_COMPLETE") {
      if (/"missingLetters"\s*:/.test(wire) || /"alsoAccept"\s*:/.test(wire)) {
        l3.push(`${it.taskType} / ${it.title}: cloze answer key present in the client payload`);
      }
      const projected = (client.passage as Record<string, unknown>[] | undefined) ?? [];
      const authored = (it.payload.passage as { kind: string; id?: string; missingLetters?: string; alsoAccept?: string[] }[] | undefined) ?? [];
      const keyById = new Map(
        authored.filter((t) => t.kind === "blank" && t.id).map((t) => [t.id as string, t]),
      );
      for (const tok of projected) {
        if (tok.kind !== "blank") continue;
        const src = keyById.get(String(tok.id));
        if (!src) continue;
        const secrets = [src.missingLetters, ...(src.alsoAccept ?? [])].filter(Boolean) as string[];
        // Every string this token carries to the browser, checked field by field.
        // Absent fields are skipped rather than stringified: String(undefined)
        // is "undefined", which contains "ine" — so a blank keyed decl|ine was
        // reported as leaking into its own empty `suffix`. The gate was matching
        // its own placeholder, not the content.
        const carried = Object.entries(tok)
          .filter(([k, v]) => k !== "kind" && k !== "id" && v !== undefined && v !== null)
          .map(([, v]) => String(v));
        for (const secret of secrets) {
          if (carried.some((v) => v.toLowerCase().includes(secret.toLowerCase()))) {
            l3.push(`${it.taskType} / ${it.title} / ${tok.id}: keyed letters "${secret}" carried in a projected field`);
          }
        }
      }
    }
  }
  report.push(`  L3 client projection executed: ${projected}/${bank.items.length} items, ${l3.length} exposing a server-only field`);
  if (l3.length) {
    findings.push({
      severity: "FAIL",
      code: "LEAK-SERVER-ONLY-FIELD",
      message:
        `A field the server treats as an answer key reaches the browser. For the photo tasks that field ` +
        `is the exact text the AI rater judges the response against — copying it scores full relevance ` +
        `with no original language produced.`,
      items: l3,
    });
  }

  // Belt and braces: the rendered alt text must not be the rater's target.
  const raterUsesAlt = /payload\.imageAlt/.test(read(WRITE_TASK)) || /payload\.imageAlt/.test(read(SPEAK_TASK));
  const clientRendersAlt =
    /alt=\{imageAlt\}/.test(read(WRITE_COMPOSER)) || /alt=\{imageAlt\}/.test(read(SPEAK_COMPOSER));
  report.push(`  L3b rater target rendered as alt: rater reads imageAlt=${raterUsesAlt}, composer renders imageAlt=${clientRendersAlt}`);
  if (raterUsesAlt && clientRendersAlt) {
    findings.push({
      severity: "FAIL",
      code: "LEAK-RATER-TARGET-VISIBLE",
      message: `A photo composer still renders imageAlt — the rater's target — as its <img alt>.`,
    });
  }

  // ---- L4: the projection must fail CLOSED ----
  let denied = false;
  let denyDetail = "";
  try {
    toClientPayload("NOT_A_REAL_TASK_TYPE" as never, { secret: "answer key" });
    denyDetail = "returned a value instead of throwing";
  } catch {
    denied = true;
  }
  const missing = bank.liveTaskTypes.filter((t) => !projectedTaskTypes().includes(t));
  report.push(
    `  L4 default-deny: unknown task type ${denied ? "REFUSED" : "ACCEPTED"}; ` +
      `${bank.liveTaskTypes.length - missing.length}/${bank.liveTaskTypes.length} live types have an explicit projection`,
  );
  if (!denied) {
    findings.push({
      severity: "FAIL",
      code: "PROJECTION-FAILS-OPEN",
      message:
        `toClientPayload accepted an unknown task type (${denyDetail}). Any type without an explicit ` +
        `projection would ship its raw payload — answer key included. With 9 DET question types still ` +
        `to build, the default must be deny.`,
    });
  }
  if (missing.length) {
    findings.push({
      severity: "FAIL",
      code: "PROJECTION-MISSING",
      message: `A live task type has no client-payload projection.`,
      items: missing,
    });
  }

  // Nothing may bypass the projection by handing raw payload to a composer.
  const sessionSrc = read(SESSION_PAGE);
  if (/payload=\{[^}]*item\.payload\s*\}/.test(sessionSrc)) {
    findings.push({
      severity: "FAIL",
      code: "PROJECTION-BYPASSED",
      message: `${SESSION_PAGE} passes item.payload to the composer without projecting it.`,
    });
  }

  return { findings, report };
});
