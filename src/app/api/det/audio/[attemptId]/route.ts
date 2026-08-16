// GET /api/det/audio/[attemptId] — the Listen and Type prompt audio.
//
// Preferred path: the item was pre-rendered by scripts/generate-det-audio.mts,
// so we redirect to its Vercel Blob URL and the CDN serves the bytes. No OpenAI
// call happens on this path at all.
//
// Fallback path: if no DetItemAudio row exists for this item, synthesize on
// demand exactly as before — byte for byte the original behaviour, so an
// un-rendered item plays rather than 404s.
//
// Either way the sentence text never reaches the client: it is the answer.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { synthesizeSpeech } from "@/lib/ai/openai";
import { listenAndTypePayloadSchema } from "@/lib/det/tasks/listen-and-type";

export const runtime = "nodejs";
export const maxDuration = 30;

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

  // Pre-rendered? Redirect to Blob and skip OpenAI entirely. The ownership and
  // task-type checks above still run first, so someone else's attempt 404s
  // exactly as it did before rather than being redirected.
  //
  // Gated on the ROW ALONE — deliberately NOT on isBlobConfigured(). That helper
  // tests BLOB_READ_WRITE_TOKEN, which is a WRITE credential; reading a public
  // Blob URL needs no token at all. The deployed app does not carry that token,
  // so gating on it here would make this branch permanently false in production
  // and quietly leave every request on the on-demand path — the exact cost bug
  // this change exists to kill. isBlobConfigured() belongs only in the write
  // path (scripts/generate-det-audio.mts).
  //
  // The REDIRECT is per-user and auth-gated, so it stays private/no-store. The
  // Blob URL it points at carries its own public CDN cache headers, which is
  // where the caching actually happens.
  const pre = await prisma.detItemAudio.findUnique({
    where: { itemId_seg: { itemId: attempt.itemId, seg: 0 } },
    select: { audioUrl: true },
  });
  if (pre?.audioUrl) {
    return new Response(null, {
      status: 302,
      headers: { Location: pre.audioUrl, "Cache-Control": "private, no-store" },
    });
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
