// OpenAI helpers via fetch (no SDK dependency): on-demand TTS for Listen and
// Type prompt audio, and Whisper transcription for Speak About the Photo. Both
// record cost to the AICostLedger.

import { TTS_USD_PER_1K_CHARS } from "@/lib/ai/models";
import { computeTranscriptionCostCents } from "@/lib/ai/cost";
import { recordExternalCost, recordTranscriptionCost } from "@/lib/ai/anthropic-client";

const OPENAI_BASE = "https://api.openai.com/v1";

function getKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k || k.length < 20 || k === "TODO_FOUNDER_PROVIDES") {
    throw new Error("OPENAI_API_KEY missing or invalid — set a real key in Vercel env");
  }
  return k;
}

/** Generate spoken audio (mp3) from text. Kept server-side so the Listen and
 *  Type sentence never reaches the client. */
export async function synthesizeSpeech(
  text: string,
  userId: string | null,
): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "alloy",
        input: text,
        response_format: "mp3",
      }),
    });
  } catch (err) {
    await recordExternalCost({
      userId,
      feature: "listen-and-type.tts",
      model: "tts-1",
      costCents: 0,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  if (!res.ok) {
    await recordExternalCost({
      userId,
      feature: "listen-and-type.tts",
      model: "tts-1",
      costCents: 0,
      success: false,
      errorMessage: `TTS HTTP ${res.status}`,
    });
    throw new Error(`TTS request failed: ${res.status}`);
  }
  const costCents = Math.round((text.length / 1000) * TTS_USD_PER_1K_CHARS["tts-1"] * 10_000);
  await recordExternalCost({
    userId,
    feature: "listen-and-type.tts",
    model: "tts-1",
    costCents,
    success: true,
  });
  return res.arrayBuffer();
}

/** Transcribe a recorded audio clip with Whisper. */
export async function transcribeAudio(args: {
  file: Blob;
  filename: string;
  durationSeconds: number;
  userId: string | null;
}): Promise<string> {
  const form = new FormData();
  form.append("file", args.file, args.filename);
  form.append("model", "whisper-1");

  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getKey()}` },
      body: form,
    });
  } catch (err) {
    await recordTranscriptionCost({
      userId: args.userId,
      feature: "speak-about-photo.transcribe",
      model: "whisper-1",
      durationSeconds: args.durationSeconds,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  if (!res.ok) {
    await recordTranscriptionCost({
      userId: args.userId,
      feature: "speak-about-photo.transcribe",
      model: "whisper-1",
      durationSeconds: args.durationSeconds,
      success: false,
      errorMessage: `Whisper HTTP ${res.status}`,
    });
    throw new Error(`Transcription request failed: ${res.status}`);
  }
  await recordTranscriptionCost({
    userId: args.userId,
    feature: "speak-about-photo.transcribe",
    model: "whisper-1",
    durationSeconds: args.durationSeconds,
    success: true,
  });
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

// computeTranscriptionCostCents is re-exported for callers that need the raw
// figure without recording (none yet, but keeps the cost module discoverable).
export { computeTranscriptionCostCents };
