// SPEAK ABOUT THE PHOTO (Speaking, AI).
//
// The user speaks about a scene; the recording is transcribed with Whisper
// (server-side), then an AI rater (Claude Sonnet) reads the TRANSCRIPT and
// returns honest trait levels. We are explicit, in the prompt and the UI, that
// this is estimated from a transcript — NOT acoustic analysis — so pronunciation
// and accent are never judged. All scenes are original to AlmiDET.

import { z } from "zod";
import { getAnthropicClient, recordCost } from "@/lib/ai/anthropic-client";
import { MODELS } from "@/lib/ai/models";
import type {
  SpeakAboutPhotoPayload,
  SpeakAboutPhotoResponse,
} from "@/lib/det/types";

const TRAIT = z.enum(["strong", "adequate", "limited"]);

export const speakAboutPhotoPayloadSchema = z.object({
  imageUrl: z.string(),
  imageAlt: z.string().min(1),
  prepSeconds: z.number().int().nonnegative(),
  speakSeconds: z.number().int().positive(),
});

export const speakAboutPhotoResponseSchema = z.object({
  transcript: z.string(),
});

const feedbackSchema = z.object({
  contentRelevance: TRAIT, // does the speech actually describe the scene / address the task
  fluencyOnTopic: TRAIT, // coherence and flow OF THE WORDS (not pronunciation)
  rangeAndAccuracy: TRAIT, // grammar + vocabulary
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  overallComment: z.string(),
});

export type SpeakAboutPhotoFeedback = z.infer<typeof feedbackSchema>;

export type AiScore = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  feedback: SpeakAboutPhotoFeedback;
  telemetry: { aiModel: string; costCents: number; latencyMs: number };
};

const POINTS_MAX = 12;

const SYSTEM = `You are an honest speaking coach for AlmiDET, a Duolingo English Test (DET) practice tool.

You rate a "Speak About the Photo" practice answer from a TRANSCRIPT of what the speaker said. Rules:
- You only see a transcript — NOT the audio. Never judge pronunciation, accent, or voice. Estimate fluency only from the coherence and flow of the words.
- All content here is original to AlmiDET. Never reference or reproduce real Duolingo test material.
- This is a PRACTICE ESTIMATE, not an official DET result. Never state a DET score or number, and never promise a score.
- Be honest and constructive. If it is limited, say so plainly but kindly. Do not inflate.
- Banned words: "weak", "poor", "wrong", "failed". Prefer "improvement opportunity".

Return ONLY a JSON object, no prose around it, with exactly these keys:
{
  "contentRelevance": "strong" | "adequate" | "limited",
  "fluencyOnTopic": "strong" | "adequate" | "limited",
  "rangeAndAccuracy": "strong" | "adequate" | "limited",
  "strengths": string[],        // 1-3 short, specific
  "improvements": string[],     // 1-3 short, specific, actionable
  "overallComment": string      // one or two honest sentences
}`;

const LEVEL_VALUE: Record<z.infer<typeof TRAIT>, number> = {
  strong: 1.0,
  adequate: 0.6,
  limited: 0.3,
};

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function evaluateSpeakAboutPhoto(args: {
  payload: SpeakAboutPhotoPayload;
  response: SpeakAboutPhotoResponse;
  userId: string;
}): Promise<AiScore> {
  const { payload, response, userId } = args;
  const transcript = response.transcript.trim();
  const wordCount = transcript ? transcript.split(/\s+/).length : 0;

  const userMessage = `SCENE (description, original to AlmiDET): ${payload.imageAlt}
TASK: Speak about the scene for up to ${payload.speakSeconds} seconds.
TRANSCRIPT WORD COUNT: ${wordCount}

TRANSCRIPT OF WHAT THE SPEAKER SAID:
"""
${transcript || "(nothing transcribed)"}
"""

Rate it per the rules and return the JSON object.`;

  const client = getAnthropicClient();
  const startedAt = Date.now();
  let feedback: SpeakAboutPhotoFeedback;
  let usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  try {
    const res = await client.messages.create({
      model: MODELS.SONNET,
      max_tokens: 600,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });
    usage = {
      inputTokens: res.usage.input_tokens ?? 0,
      outputTokens: res.usage.output_tokens ?? 0,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
    };
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    feedback = feedbackSchema.parse(extractJson(raw));
  } catch (err) {
    await recordCost({
      userId,
      feature: "speak-about-photo.evaluate",
      model: MODELS.SONNET,
      usage,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const costCents = await recordCost({
    userId,
    feature: "speak-about-photo.evaluate",
    model: MODELS.SONNET,
    usage,
    success: true,
  });

  let fraction =
    (LEVEL_VALUE[feedback.contentRelevance] +
      LEVEL_VALUE[feedback.fluencyOnTopic] +
      LEVEL_VALUE[feedback.rangeAndAccuracy]) /
    3;
  // A very short answer is a real limitation regardless of the trait read.
  if (wordCount < 15) fraction *= 0.5;

  const pointsEarned = Math.round(fraction * POINTS_MAX);
  return {
    pointsEarned,
    pointsMax: POINTS_MAX,
    fraction,
    feedback,
    telemetry: {
      aiModel: MODELS.SONNET,
      costCents,
      latencyMs: Date.now() - startedAt,
    },
  };
}
