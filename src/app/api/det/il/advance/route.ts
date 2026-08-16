// POST /api/det/il/advance — the stage gate for Interactive Listening.
//
// This route is the reason Stage A is actually locked rather than merely
// greyed out. It records the stage the taker just finished and returns ONLY the
// next stage; it refuses to re-open a stage that is already answered.
//
// It does NOT score anything. Scoring is /api/det/submit, which runs once at the
// end, keeps the hasPaidAccess() gate on the AI rater, and reads the answers
// this route stored rather than trusting a final client post.
//
// Nothing about the answer key crosses here. The response body is the same
// projected view src/lib/det/il-stages.ts builds for the render seam.

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { interactiveListeningPayloadSchema } from "@/lib/det/tasks/interactive-listening";
import {
  advanceIL,
  projectILView,
  readILAnswers,
  readILProgress,
  type ILStep,
} from "@/lib/det/il-stages";

export const runtime = "nodejs";

const bodySchema = z.object({
  attemptId: z.string().min(1),
  step: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("complete"),
      filled: z.record(z.string(), z.string()),
    }),
    z.object({
      kind: z.literal("turn"),
      index: z.number().int().nonnegative(),
      // The DISPLAYED position, not the authored index and never the key. The
      // server re-derives the permutation to map it home.
      chosen: z.number().int().nonnegative(),
    }),
  ]),
});

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    parsedBody = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { attemptId, step } = parsedBody;

  const attempt = await prisma.detAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: { item: true },
  });
  if (!attempt || attempt.taskType !== "INTERACTIVE_LISTENING") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (attempt.status === "SCORED") {
    return NextResponse.json(
      { ok: false, error: "This attempt has already been scored." },
      { status: 409 },
    );
  }

  const payload = interactiveListeningPayloadSchema.safeParse(attempt.item.payload);
  if (!payload.success) {
    console.error("[det.il.advance] unparsable payload:", attempt.itemId);
    return NextResponse.json({ ok: false, error: "Bad item" }, { status: 500 });
  }

  // Pre-rendered clips. An item with none projects audioUrl: null throughout,
  // which the composer surfaces honestly rather than dead-ending on.
  const audioRows = await prisma.detItemAudio.findMany({
    where: { itemId: attempt.itemId },
    select: { seg: true, audioUrl: true },
  });
  const audio: Record<number, string> = {};
  for (const r of audioRows) if (r.audioUrl) audio[r.seg] = r.audioUrl;

  const progress = readILProgress(attempt.response);
  const result = advanceIL(payload.data, progress, step as ILStep);

  if (!result.ok) {
    // A rejection is not an error page — the client may simply be out of step
    // after a reload. Hand back the CURRENT view so it can resync in place.
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        view: projectILView(attempt.item.payload, { audio, stored: attempt.response }),
      },
      { status: 409 },
    );
  }

  // Merge, never overwrite. `filled` is written once, on the single Stage A
  // submission advanceIL() allows; each turn's choice is written once, on the
  // turn advanceIL() had released. There is no path here that revises an answer.
  const prior = readILAnswers(attempt.response);
  const stored = {
    filled: { ...prior.filled, ...(result.patch.filled ?? {}) },
    chosen: { ...prior.chosen, ...(result.patch.chosen ?? {}) },
    summary: prior.summary,
    progress: result.progress,
  };

  await prisma.detAttempt.update({
    where: { id: attempt.id },
    data: { response: stored as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({
    ok: true,
    view: projectILView(attempt.item.payload, { audio, stored }),
  });
}
