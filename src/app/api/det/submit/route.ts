// Unified submit endpoint for every DET task. The route does NOT branch on task
// type — it looks the handler up in the registry, runs it, turns the result
// into an honest per-subscore practice range, and persists. AI tasks are gated
// on paid access; objective tasks are free practice (a v1 free-tier placeholder
// pending the founder's call).

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hasPaidAccess } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { DET_HANDLERS, DET_TASKS } from "@/lib/det/registry";
import { fractionToRange } from "@/lib/det/scale";
import { subscoreEstimateFromSkill } from "@/lib/det/subscores";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { attemptId?: unknown; response?: unknown; timeSpentSeconds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
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

  const def = DET_TASKS[attempt.taskType];
  const handler = DET_HANDLERS[attempt.taskType];
  if (!handler) {
    return NextResponse.json(
      { ok: false, error: "This task is not available yet" },
      { status: 400 },
    );
  }

  // AI feedback is a paid feature; objective auto-marking is free practice.
  if (handler.mode === "AI" && !hasPaidAccess(user)) {
    return NextResponse.json(
      { ok: false, error: "AI feedback needs a subscription", upgradeUrl: "/pricing" },
      { status: 402 },
    );
  }

  let run;
  try {
    run = await handler.run({
      payload: attempt.item.payload,
      response: body.response,
      userId: user.id,
    });
  } catch (err) {
    console.error("[det.submit] scoring failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not score this attempt. Try again in a moment." },
      { status: 500 },
    );
  }

  const skillRange = fractionToRange(run.fraction);
  const subscoreEstimate = subscoreEstimateFromSkill(def.skill, skillRange);
  const timeSpent =
    typeof body.timeSpentSeconds === "number" && body.timeSpentSeconds >= 0
      ? Math.round(body.timeSpentSeconds)
      : 0;

  await prisma.detAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SCORED",
      response: (body.response ?? {}) as Prisma.InputJsonValue,
      pointsEarned: run.pointsEarned,
      pointsMax: run.pointsMax,
      subscoreEstimate: subscoreEstimate as unknown as Prisma.InputJsonValue,
      feedback: (run.feedback ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      aiModel: run.telemetry?.aiModel ?? null,
      costCents: run.telemetry?.costCents ?? null,
      latencyMs: run.telemetry?.latencyMs ?? null,
      submittedAt: new Date(),
      timeSpentSeconds: timeSpent,
    },
  });

  return NextResponse.json({ ok: true });
}
