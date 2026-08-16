// POST /api/det/staged/advance — the stage gate for every task answered in
// locked steps.
//
// This route is the reason a submitted stage is actually locked rather than
// merely greyed out. It records the stage the taker just finished and returns
// ONLY what they are now entitled to; it refuses to re-open a stage that is
// already answered.
//
// TASK-AGNOSTIC. It looks the task type up in STAGE_DRIVERS and calls it — no
// branch on task type anywhere below. Interactive Listening and Interactive
// Writing share every line of this file; a third staged type adds a driver and
// nothing here.
//
// It does NOT score. Scoring is /api/det/submit, which runs once at the end,
// keeps the hasPaidAccess() gate on the AI rater, and reads the answers this
// route stored rather than trusting a final client post.

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stageDriverFor } from "@/lib/det/staged-drivers";
import { mergeStoredAnswers } from "@/lib/det/staged";

export const runtime = "nodejs";

const envelopeSchema = z.object({
  attemptId: z.string().min(1),
  step: z.unknown(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let envelope: z.infer<typeof envelopeSchema>;
  try {
    envelope = envelopeSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const attempt = await prisma.detAttempt.findFirst({
    where: { id: envelope.attemptId, userId: user.id },
    include: { item: true },
  });
  if (!attempt) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const driver = stageDriverFor(attempt.taskType);
  if (!driver) {
    // Not a staged task — there is no stage to advance, and pretending otherwise
    // would write progress onto a response that nothing reads.
    return NextResponse.json(
      { ok: false, error: "This task is not answered in stages." },
      { status: 400 },
    );
  }
  if (attempt.status === "SCORED") {
    return NextResponse.json(
      { ok: false, error: "This attempt has already been scored." },
      { status: 409 },
    );
  }

  const parsedStep = driver.stepSchema.safeParse(envelope.step);
  if (!parsedStep.success) {
    return NextResponse.json({ ok: false, error: "Invalid step" }, { status: 400 });
  }

  // Pre-rendered clips, for the staged types that project audio. An item with
  // none projects audioUrl: null throughout, which the composer surfaces
  // honestly rather than dead-ending on.
  const audio: Record<number, string> = {};
  if (driver.needsAudio) {
    const rows = await prisma.detItemAudio.findMany({
      where: { itemId: attempt.itemId },
      select: { seg: true, audioUrl: true },
    });
    for (const r of rows) if (r.audioUrl) audio[r.seg] = r.audioUrl;
  }

  let result;
  try {
    result = driver.advance(attempt.item.payload, attempt.response, parsedStep.data);
  } catch (err) {
    console.error("[det.staged.advance] driver threw:", err);
    return NextResponse.json({ ok: false, error: "Bad item" }, { status: 500 });
  }

  const view = (stored: unknown) => driver.project(attempt.item.payload, { audio, stored });

  if (!result.ok) {
    // A rejection is not an error page — the client may simply be out of step
    // after a reload. Hand back the CURRENT view so it can resync in place.
    return NextResponse.json(
      { ok: false, error: result.error, view: view(attempt.response) },
      { status: 409 },
    );
  }

  // Merge, never overwrite. A driver only ever patches the stage it just
  // allowed, so there is no path here that revises an earlier answer.
  const stored = mergeStoredAnswers(attempt.response, result.patch, result.progress);

  await prisma.detAttempt.update({
    where: { id: attempt.id },
    data: { response: stored as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true, view: view(stored) });
}
