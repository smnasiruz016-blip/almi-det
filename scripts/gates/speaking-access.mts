// gate:speaking-access — can an unpaid or over-cap attempt reach the billed step?
//
// Speaking is the only skill where an attempt COSTS MONEY BEFORE IT IS GRADED,
// so the guards are not just about entitlement — their ORDER is the cost control.
// A refusal issued after the Whisper call has already gone out costs exactly as
// much as an accepted attempt, and nothing on the receipt would say so.
//
//   SA1 UNPAID REFUSED       an unpaid user gets 402 and the transcriber is
//                            NEVER CALLED.
//   SA2 CAP REFUSED          the (cap+1)th attempt of the day gets 429 and the
//                            transcriber is NEVER CALLED.
//   SA3 CAP BOUNDARY         the cap-th attempt is still allowed — an off-by-one
//                            here silently costs a user their last attempt.
//   SA4 PAID + UNDER CAP     goes through, transcribes exactly once, and grades.
//   SA5 BOTH ROUTES GUARDED  every speaking task type is guarded wherever it can
//                            actually be submitted.
//
// HOW THIS IS TESTED, AND WHY IT MAKES NO NETWORK CALL.
//
// runSpeakingAttempt takes its transcriber and its attempt counter as arguments.
// This gate hands it a STUB transcriber that records that it was called and
// returns a canned string. So the real ordering logic runs — the same function
// the route calls — with no OpenAI, no database, and no spend. A gate that
// exercised the real transcriber would be a gate nobody could afford to run.
//
// SA5 IS A SOURCE CHECK and says so. Two routes can submit a speaking task
// today: /api/det/speak/submit (the kernel) and /api/det/submit (where Speak
// About the Photo still arrives). A behavioural test would need the Next runtime;
// what is checked instead is that the second route names the same guards.

import { readFileSync } from "node:fs";
import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const SUBMIT_ROUTE = "src/app/api/det/submit/route.ts";
const SPEAK_ROUTE = "src/app/api/det/speak/submit/route.ts";

const read = (p: string): string => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

export default defineGate("gate:speaking-access", async (_bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  const { runSpeakingAttempt, SPEAKING_DAILY_CAP } = await import("../../src/lib/det/speaking");
  const { SPEAKING_TASKS, speakingTaskTypes } = await import("../../src/lib/det/speaking-tasks");

  const task = SPEAKING_TASKS.READ_ALOUD;
  if (!task) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-NO-TASK",
      message: "READ_ALOUD is not registered as a speaking task, so nothing here can be checked.",
    });
    return { findings, report };
  }

  /** A transcriber that bills nothing and remembers whether it was reached. */
  const makeStub = () => {
    const state = { calls: 0, features: [] as string[] };
    const transcribe = async (a: { feature: string }) => {
      state.calls++;
      state.features.push(a.feature);
      return "the children played happily in the park after school";
    };
    return { state, transcribe };
  };

  const audio = { file: new Blob(["x".repeat(64)]), filename: "s.webm", durationSeconds: 4 };
  const payload = { text: "The children played happily in the park after school." };

  const problems: string[] = [];

  // ---- SA1 unpaid ----
  {
    const { state, transcribe } = makeStub();
    const out = await runSpeakingAttempt({
      userId: "u1",
      isPaid: false,
      task,
      payload,
      audio,
      deps: { countAttemptsToday: async () => 0, transcribe },
    });
    const refused = !out.ok && out.status === 402 && out.reason === "UNPAID";
    report.push(
      `    SA1 unpaid refused             : ${refused ? "402 UNPAID" : "NOT REFUSED"}, transcriber calls=${state.calls}`,
    );
    if (!refused) problems.push("an unpaid user was not refused with 402");
    if (state.calls > 0) {
      problems.push(
        `the transcriber ran ${state.calls} time(s) for an UNPAID user — a refusal that costs money`,
      );
    }
  }

  // ---- SA2 over the cap ----
  {
    const { state, transcribe } = makeStub();
    const out = await runSpeakingAttempt({
      userId: "u1",
      isPaid: true,
      task,
      payload,
      audio,
      deps: { countAttemptsToday: async () => SPEAKING_DAILY_CAP, transcribe },
    });
    const refused = !out.ok && out.status === 429 && out.reason === "DAILY_CAP";
    report.push(
      `    SA2 (cap+1)th refused          : ${refused ? "429 DAILY_CAP" : "NOT REFUSED"}, transcriber calls=${state.calls}`,
    );
    if (!refused) problems.push(`attempt ${SPEAKING_DAILY_CAP + 1} of the day was not refused`);
    if (state.calls > 0) {
      problems.push(
        `the transcriber ran ${state.calls} time(s) for an OVER-CAP attempt — the cap did not bound spend`,
      );
    }
  }

  // ---- SA3 the boundary is inclusive ----
  {
    const { state, transcribe } = makeStub();
    const out = await runSpeakingAttempt({
      userId: "u1",
      isPaid: true,
      task,
      payload,
      audio,
      deps: { countAttemptsToday: async () => SPEAKING_DAILY_CAP - 1, transcribe },
    });
    report.push(
      `    SA3 cap-th attempt allowed     : ${out.ok ? "allowed" : "REFUSED"}, transcriber calls=${state.calls}`,
    );
    if (!out.ok) {
      problems.push(
        `attempt ${SPEAKING_DAILY_CAP} of ${SPEAKING_DAILY_CAP} was refused — off by one, a user loses their last attempt`,
      );
    }
  }

  // ---- SA4 the happy path ----
  {
    const { state, transcribe } = makeStub();
    const out = await runSpeakingAttempt({
      userId: "u1",
      isPaid: true,
      task,
      payload,
      audio,
      deps: { countAttemptsToday: async () => 0, transcribe },
    });
    const graded = out.ok && out.result.pointsMax > 0;
    report.push(
      `    SA4 paid + under cap graded    : ${graded ? `${out.ok ? out.result.pointsEarned : 0}/${out.ok ? out.result.pointsMax : 0}` : "NOT GRADED"}, transcriber calls=${state.calls}`,
    );
    if (!graded) problems.push("a paid, under-cap attempt did not produce a graded result");
    if (state.calls !== 1) {
      problems.push(`the transcriber ran ${state.calls} time(s) for one attempt — expected exactly 1`);
    }
    if (state.features[0] !== task.transcribeFeature) {
      problems.push(
        `the transcription was billed to "${state.features[0]}" instead of "${task.transcribeFeature}"`,
      );
    }
  }

  // ---- SA5 every submission route names the guards ----
  const speakSrc = read(SPEAK_ROUTE);
  const submitSrc = read(SUBMIT_ROUTE);
  const routeGaps: string[] = [];
  if (!/runSpeakingAttempt/.test(speakSrc)) {
    routeGaps.push(`${SPEAK_ROUTE} does not run the speaking kernel`);
  }
  // Speak About the Photo still arrives at the general submit route, so that
  // route must apply the same two guards or the longest-live speaking type would
  // be the one type with no cap.
  //
  // MATCHED IN THE HANDLER BODY, NOT THE FILE. The first version grepped the
  // whole source, and when the guard block was deleted to prove this check red it
  // reported CLEAN — because the IMPORT line still named `isSpeakingTask` and
  // `SPEAKING_DAILY_CAP`. The check was matching its own scaffolding. Slicing
  // from the handler down drops the imports, and the assertions below are the
  // CALL and the refusal status rather than the identifiers.
  const handlerBody = submitSrc.slice(Math.max(0, submitSrc.indexOf("export async function POST")));
  const guardsPresent =
    /isSpeakingTask\(\s*attempt\.taskType\s*\)/.test(handlerBody) &&
    /SPEAKING_DAILY_CAP/.test(handlerBody) &&
    /status:\s*429/.test(handlerBody);
  if (!guardsPresent) {
    routeGaps.push(
      `${SUBMIT_ROUTE} accepts speaking task types but its handler does not apply the paid gate and daily cap`,
    );
  }
  report.push(
    `    SA5 both submit routes guarded : ${routeGaps.length === 0 ? "clean" : `${routeGaps.length} gap(s)`}`,
  );
  report.push(
    `    (cap ${SPEAKING_DAILY_CAP}/user/day across ${speakingTaskTypes().length} speaking task type(s); no network call made by this gate)`,
  );

  if (problems.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-ACCESS",
      message:
        `A speaking guard did not hold. The order matters as much as the guard: a refusal issued ` +
        `after transcription costs exactly as much as an accepted attempt.`,
      items: problems,
    });
  }
  if (routeGaps.length) {
    findings.push({
      severity: "FAIL",
      code: "SPEAKING-ROUTE-UNGUARDED",
      message: `A route that can accept a speaking submission does not apply the paid gate and the daily cap.`,
      items: routeGaps,
    });
  }

  return { findings, report };
});
