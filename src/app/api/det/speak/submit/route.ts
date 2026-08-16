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
import { runSpeakingAttempt, startOfDay } from "@/lib/det/speaking";
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

  const outcome = await runSpeakingAttempt({
    userId: user.id,
    isPaid: hasPaidAccess(user),
    task,
    payload: attempt.item.payload,
    audio:
      rawAudio instanceof Blob
        ? {
            file: rawAudio,
            filename: "speech.webm",
            durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
          }
        : null,
    deps: {
      // Billed attempts only: an attempt row exists from the moment a session
      // step is created, so counting those would charge the cap for items the
      // user never recorded. `submittedAt` is set when one is actually scored.
      countAttemptsToday: async (userId) =>
        prisma.detAttempt.count({
          where: {
            userId,
            taskType: { in: speakingTaskTypes() },
            submittedAt: { gte: startOfDay(new Date()) },
          },
        }),
      transcribe: (a) =>
        transcribeAudio({
          file: a.file,
          filename: a.filename,
          durationSeconds: a.durationSeconds,
          userId: a.userId,
          feature: a.feature,
        }),
    },
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
