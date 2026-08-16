// gate:speaking-metered — can a transcription happen without appearing on the bill?
//
// Every speaking attempt spends money at OpenAI. AICostLedger is the only record
// of that, and it is written by the caller rather than by anything automatic —
// so an un-metered code path is not a missing log line, it is spend that exists
// in the bank statement and nowhere in the product.
//
//   SM1 EVERY EXIT PATH METERED   the transcription implementation records a
//                                 ledger row on success, on HTTP failure, and on
//                                 network failure. A `throw` that skips the
//                                 ledger still cost money.
//   SM2 NO SPEND ON REFUSAL       (behavioural) the kernel does not transcribe
//                                 for an attempt it is going to refuse.
//   SM3 DISTINCT LEDGER LABELS    each speaking type bills to its own feature,
//                                 so a per-feature reconciliation reads a number
//                                 that is about the thing it names.
//   SM4 ONE IMPLEMENTATION        nothing else in src/ posts to the transcription
//                                 endpoint. A second caller is a second place to
//                                 forget the ledger.
//
// SM1 AND SM4 ARE SOURCE CHECKS and are labelled as such. Proving them
// behaviourally would mean faking OpenAI's HTTP responses, and a gate that
// mocks a vendor tests the mock. What is checked is narrow and honest: the one
// function that calls the endpoint mentions the ledger on every branch that can
// leave it, and no other file calls that endpoint at all.

import { readFileSync } from "node:fs";
import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const OPENAI = "src/lib/ai/openai.ts";
const TRANSCRIBE_URL = "audio/transcriptions";
/** success + HTTP failure + network failure. */
const REQUIRED_LEDGER_CALLS = 3;

const read = (p: string): string => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

export default defineGate("gate:speaking-metered", async (_bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];
  const problems: string[] = [];

  // ---- SM1 every exit path of the transcriber is metered ----
  const src = read(OPENAI);
  const fnStart = src.indexOf("export async function transcribeAudio");
  const fnBody = fnStart === -1 ? "" : src.slice(fnStart);
  const ledgerCalls = (fnBody.match(/recordTranscriptionCost\(/g) ?? []).length;
  const hitsEndpoint = fnBody.includes(TRANSCRIBE_URL);
  report.push(
    `    SM1 transcriber meters every exit : ${ledgerCalls}/${REQUIRED_LEDGER_CALLS} recordTranscriptionCost call(s)`,
  );
  if (fnStart === -1 || !hitsEndpoint) {
    problems.push(`${OPENAI}: transcribeAudio not found, or no longer calls the transcription endpoint`);
  } else if (ledgerCalls < REQUIRED_LEDGER_CALLS) {
    problems.push(
      `${OPENAI}: transcribeAudio records ${ledgerCalls} ledger row(s), expected ${REQUIRED_LEDGER_CALLS} ` +
        `(success, HTTP failure, network failure). A path that throws before recording still cost money.`,
    );
  }

  // ---- SM2 no spend on a refusal (behavioural, no network) ----
  const { runSpeakingAttempt, SPEAKING_DAILY_CAP } = await import("../../src/lib/det/speaking");
  const { SPEAKING_TASKS } = await import("../../src/lib/det/speaking-tasks");
  const task = SPEAKING_TASKS.READ_ALOUD;

  let billedOnRefusal = 0;
  if (task) {
    const audio = { file: new Blob(["x".repeat(64)]), filename: "s.webm", durationSeconds: 4 };
    const payload = { text: "The children played happily in the park after school." };
    for (const [label, isPaid, used] of [
      ["unpaid", false, 0],
      ["over cap", true, SPEAKING_DAILY_CAP],
    ] as const) {
      let calls = 0;
      const out = await runSpeakingAttempt({
        userId: "u1",
        isPaid,
        task,
        payload,
        audio,
        deps: {
          countAttemptsToday: async () => used,
          transcribe: async () => {
            calls++;
            return "";
          },
        },
      });
      if (calls > 0) {
        billedOnRefusal += calls;
        problems.push(
          `a ${label} attempt reached the transcriber ${calls} time(s) — it would appear on the bill and be refused`,
        );
      }
      if (out.ok) problems.push(`a ${label} attempt was not refused at all`);
    }
  }
  report.push(
    `    SM2 refusals never transcribe     : ${billedOnRefusal === 0 ? "clean" : `${billedOnRefusal} billed refusal(s)`}`,
  );

  // ---- SM3 one ledger label per speaking type ----
  const byFeature = new Map<string, string[]>();
  for (const [t, spec] of Object.entries(SPEAKING_TASKS)) {
    const f = spec!.transcribeFeature;
    byFeature.set(f, [...(byFeature.get(f) ?? []), t]);
  }
  const shared = [...byFeature].filter(([, types]) => types.length > 1);
  report.push(
    `    SM3 one ledger label per type     : ${shared.length === 0 ? `clean (${byFeature.size} label(s))` : `${shared.length} shared`}`,
  );
  for (const [f, types] of shared) {
    problems.push(
      `ledger feature "${f}" is shared by ${types.join(" and ")} — a per-feature total would not be about either`,
    );
  }
  for (const [t, spec] of Object.entries(SPEAKING_TASKS)) {
    if (!spec!.transcribeFeature.trim()) {
      problems.push(`${t} declares an empty ledger feature, so its spend would be unattributable`);
    }
  }

  // ---- SM4 exactly one transcription implementation ----
  const callers: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const { readdirSync, statSync } = await import("node:fs");
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`;
      if (statSync(full).isDirectory()) await walk(full);
      else if (/\.(ts|tsx|mts)$/.test(name) && readFileSync(full, "utf8").includes(TRANSCRIBE_URL)) {
        callers.push(full.replace(/\\/g, "/"));
      }
    }
  };
  await walk("src");
  report.push(`    SM4 one transcription caller      : ${callers.length} file(s) — ${callers.join(", ") || "none"}`);
  if (callers.length !== 1) {
    problems.push(
      `${callers.length} file(s) post to the transcription endpoint (${callers.join(", ")}). ` +
        `Each one is a separate place to forget the ledger; route them through the metered helper.`,
    );
  }

  if (problems.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-UNMETERED",
      message:
        `A transcription could happen without a matching AICostLedger row, or be billed to the wrong ` +
        `feature. The ledger is the only record of speaking spend — an un-metered path is money that ` +
        `exists on the invoice and nowhere in the product.`,
      items: problems,
    });
  }

  return { findings, report };
});
