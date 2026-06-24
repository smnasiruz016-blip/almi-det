// On-demand TTS for Listen and Type. Generates the prompt audio server-side so
// the sentence text never reaches the client (it's the answer). Ownership-scoped
// to the requesting user's attempt.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { synthesizeSpeech } from "@/lib/ai/openai";
import { listenAndTypePayloadSchema } from "@/lib/det/tasks/listen-and-type";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ attemptId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  const attempt = await prisma.detAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: { item: true },
  });
  if (!attempt || attempt.taskType !== "LISTEN_AND_TYPE") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const parsed = listenAndTypePayloadSchema.safeParse(attempt.item.payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad item" }, { status: 500 });
  }
  const script = parsed.data.audioScript ?? parsed.data.sentence;

  try {
    const audio = await synthesizeSpeech(script, user.id);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[det.audio] tts failed:", err);
    return NextResponse.json({ ok: false, error: "Audio unavailable" }, { status: 500 });
  }
}
