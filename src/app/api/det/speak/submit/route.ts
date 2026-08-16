// POST /api/det/speak/submit — the one entry point for microphone answers.
//
// Multipart: `attemptId`, the recorded `audio` blob, `durationSeconds`, and
// `timeSpentSeconds`. Everything about ordering, cost and refusal lives in
// src/lib/det/speaking.ts; this file supplies the real database and the real
// transcriber and does nothing clever of its own.
//
// WHY A SEPARATE ROUTE FROM /api/det/submit. Speaking is the only skill that
// spends money before it can be graded, so it is the only one that needs a paid
// check and a spend cap ahead of the work. Putting that in the general submit
// route would mean every reading item paid the cost of a guard it does not need,
// and would bury the one flow where the order of the guards is the whole point.

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hasPaidAccess } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { DET_TASKS } from "@/lib/det/registry";
import { fractionToRange } from "@/lib/det/scale";
import { subscoreEstimateFromSkill } from "@/lib/det/subscores";
import { transcribeAudio } from "@/lib/ai/openai";
import {
  runSpeakingAttempt,
  transcribeSpeakingTurn,
  startOfDay,
} from "@/lib/det/speaking";
import { stageDriverFor } from "@/lib/det/staged-drivers";
import { mergeStoredAnswers } from "@/lib/det/staged";
import { speakingTaskFor, speakingTaskTypes } from "@/lib/det/speaking-tasks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "Expected an audio upload" }, { status: 400 });
  }

  const form = await req.formData();
  const attemptId = String(form.get("attemptId") ?? "");
  const rawAudio = form.get("audio");
  const durationSeconds = Number(form.get("durationSeconds") ?? 0);
  const timeSpent = Number(form.get("timeSpentSeconds") ?? 0);

  if (!attemptId) {
    return NextResponse.json({ ok: false, error: "Missing attemptId" }, { status: 400 });
  }

  const attempt = await prisma.detAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: { item: true },
  });
  if (!attempt) {
    return NextResponse.json({ ok: false, error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status === "SCORED") {
    return NextResponse.json({ ok: true, alreadyScored: true });
  }

  const task = speakingTaskFor(attempt.taskType);
  if (!task) {
    return NextResponse.json(
      { ok: false, error: "This task is not answered by recording." },
      { status: 400 },
    );
  }

  // Pre-rendered question clips, for the staged types whose stimulus is audio.
  const audio: Record<number, string> = {};
  const driver = stageDriverFor(attempt.taskType);
  if (driver?.needsAudio) {
    const rows = await prisma.detItemAudio.findMany({
      where: { itemId: attempt.itemId },
      select: { seg: true, audioUrl: true },
    });
    for (const r of rows) if (r.audioUrl) audio[r.seg] = r.audioUrl;
  }

  const countAttemptsToday = async (userId: string) =>
    prisma.detAttempt.count({
      where: {
        userId,
        taskType: { in: speakingTaskTypes() },
        submittedAt: { gte: startOfDay(new Date()) },
      },
    });

  const transcribe = (a: {
    file: Blob;
    filename: string;
    durationSeconds: number;
    userId: string;
    feature: string;
  }) =>
    transcribeAudio({
      file: a.file,
      filename: a.filename,
      durationSeconds: a.durationSeconds,
      userId: a.userId,
      feature: a.feature,
    });

  const uploaded =
    rawAudio instanceof Blob
      ? {
          file: rawAudio,
          filename: "speech.webm",
          durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        }
      : null;

  // ---------------------------------------------------------------------------
  // STAGED SPEAKING — one turn per upload.
  //
  // Each turn is guarded and transcribed (billed and metered on its own), then
  // recorded through the SAME stage machinery the text-based staged types use,
  // so turn n+1's clip is not released until turn n is stored. Only the LAST
  // turn triggers the single holistic rating and marks the attempt scored, which
  // is what makes one interview one attempt against the daily cap rather than
  // four.
  // ---------------------------------------------------------------------------
  if (driver) {
    const turnIndex = Number(form.get("turnIndex") ?? -1);
    if (!Number.isInteger(turnIndex) || turnIndex < 0) {
      return NextResponse.json({ ok: false, error: "Missing turnIndex" }, { status: 400 });
    }

    const turn = await transcribeSpeakingTurn({
      userId: user.id,
      isPaid: hasPaidAccess(user),
      task,
      audio: uploaded,
      deps: { countAttemptsToday, transcribe },
    });
    if (!turn.ok) {
      return NextResponse.json(
        { ok: false, error: turn.error, upgradeUrl: turn.upgradeUrl, reason: turn.reason },
        { status: turn.status },
      );
    }

    const step = driver.stepSchema.safeParse({
      kind: "turn",
      index: turnIndex,
      transcript: turn.transcript,
    });
    if (!step.success) {
      return NextResponse.json({ ok: false, error: "Invalid turn" }, { status: 400 });
    }

    const advanced = driver.advance(attempt.item.payload, attempt.response, step.data);
    if (!advanced.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: advanced.error,
          view: driver.project(attempt.item.payload, { audio, stored: attempt.response }),
        },
        { status: 409 },
      );
    }

    const stored = mergeStoredAnswers(attempt.response, advanced.patch, advanced.progress);
    const finished = advanced.progress.stage === "done";

    if (!finished) {
      await prisma.detAttempt.update({
        where: { id: attempt.id },
        data: { response: stored as unknown as Prisma.InputJsonValue },
      });
      return NextResponse.json({
        ok: true,
        view: driver.project(attempt.item.payload, { audio, stored }),
      });
    }

    // Last turn: one holistic rating over every transcript, then persist.
    const graded = await task.grade({
      transcript: JSON.stringify(stored),
      payload: attempt.item.payload,
      userId: user.id,
    });
    const def = DET_TASKS[attempt.taskType];
    const range = fractionToRange(graded.fraction);
    await prisma.detAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SCORED",
        response: stored as unknown as Prisma.InputJsonValue,
        pointsEarned: graded.pointsEarned,
        pointsMax: graded.pointsMax,
        subscoreEstimate: subscoreEstimateFromSkill(def.skill, range) as unknown as Prisma.InputJsonValue,
        feedback: (graded.feedback ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        aiModel: graded.telemetry?.aiModel ?? null,
        costCents: graded.telemetry?.costCents ?? null,
        latencyMs: graded.telemetry?.latencyMs ?? null,
        submittedAt: new Date(),
        timeSpentSeconds: Number.isFinite(timeSpent) && timeSpent >= 0 ? Math.round(timeSpent) : 0,
      },
    });
    return NextResponse.json({ ok: true, finished: true });
  }

  const outcome = await runSpeakingAttempt({
    userId: user.id,
    isPaid: hasPaidAccess(user),
    task,
    payload: attempt.item.payload,
    audio: uploaded,
    // Billed attempts only: an attempt row exists from the moment a session step
    // is created, so counting those would charge the cap for items the user
    // never recorded. `submittedAt` is set when one is actually scored.
    deps: { countAttemptsToday, transcribe },
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error, upgradeUrl: outcome.upgradeUrl, reason: outcome.reason },
      { status: outcome.status },
    );
  }

  const def = DET_TASKS[attempt.taskType];
  const skillRange = fractionToRange(outcome.result.fraction);
  const subscoreEstimate = subscoreEstimateFromSkill(def.skill, skillRange);

  await prisma.detAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SCORED",
      response: { transcript: outcome.transcript } as unknown as Prisma.InputJsonValue,
      pointsEarned: outcome.result.pointsEarned,
      pointsMax: outcome.result.pointsMax,
      subscoreEstimate: subscoreEstimate as unknown as Prisma.InputJsonValue,
      feedback: (outcome.result.feedback ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      aiModel: outcome.result.telemetry?.aiModel ?? null,
      costCents: outcome.result.telemetry?.costCents ?? null,
      latencyMs: outcome.result.telemetry?.latencyMs ?? null,
      submittedAt: new Date(),
      timeSpentSeconds: Number.isFinite(timeSpent) && timeSpent >= 0 ? Math.round(timeSpent) : 0,
    },
  });

  return NextResponse.json({ ok: true });
}
