// WRITE ABOUT THE PHOTO (Writing, AI).
//
// The test-taker writes at least ~50 words describing a photo. An AI rater
// (Claude Sonnet) returns qualitative TRAIT levels + honest, constructive
// notes. We convert the trait read into conservative practice points and a
// 10–160 skill range — never a DET score, never an inflated one.
//
// Honesty + IP doctrine, enforced in the system prompt below:
//   - All prompts/photos are original to AlmiDET; we never reproduce Duolingo
//     material.
//   - The output is a practice estimate, not an official DET result.
//   - Score honestly; if it's limited, say so constructively.
//
// Structured output: we ask for a JSON object and validate it with Zod AFTER
// parsing (the Anthropic structured-output endpoint rejects min/max/items
// constraints, so we keep the request plain and enforce shape in code).

import { z } from "zod";
import { getAnthropicClient, recordCost } from "@/lib/ai/anthropic-client";
import { MODELS } from "@/lib/ai/models";
import type {
  WriteAboutPhotoPayload,
  WriteAboutPhotoResponse,
} from "@/lib/det/types";

const TRAIT = z.enum(["strong", "adequate", "limited"]);

export const writeAboutPhotoPayloadSchema = z.object({
  // Optional real photo URL. When empty, the composer shows a captioned scene
  // placeholder (the imageAlt). The AI rater always judges against imageAlt, so
  // the human and the rater see a consistent scene either way.
  imageUrl: z.string(),
  imageAlt: z.string().min(1),
  minWords: z.number().int().nonnegative(),
});

export const writeAboutPhotoResponseSchema = z.object({
  text: z.string(),
});

const feedbackSchema = z.object({
  taskRelevance: TRAIT, // does the writing actually describe the photo / address the task
  rangeAndAccuracy: TRAIT, // grammar + vocabulary range and control
  clarity: TRAIT, // organisation + readability
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  overallComment: z.string(),
});

export type WriteAboutPhotoFeedback = z.infer<typeof feedbackSchema>;

export type AiScore = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  feedback: WriteAboutPhotoFeedback;
  telemetry: { aiModel: string; costCents: number; latencyMs: number };
};

const POINTS_MAX = 12;

const SYSTEM = `You are an honest writing coach for AlmiDET, a Duolingo English Test (DET) practice tool.

You rate a short "Write About the Photo" practice response. Rules:
- All content here is original to AlmiDET. Never reference or reproduce real Duolingo test material.
- This is a PRACTICE ESTIMATE, not an official DET result. Never state a DET score or number, and never promise a score.
- Be honest and constructive. If the writing is limited, say so plainly but kindly. Do not inflate.
- Banned words: "weak", "poor", "wrong", "failed". Prefer "improvement opportunity".
- Judge only what was written; do not invent details about the photo beyond the provided description.

Return ONLY a JSON object, no prose around it, with exactly these keys:
{
  "taskRelevance": "strong" | "adequate" | "limited",
  "rangeAndAccuracy": "strong" | "adequate" | "limited",
  "clarity": "strong" | "adequate" | "limited",
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

export async function evaluateWriteAboutPhoto(args: {
  payload: WriteAboutPhotoPayload;
  response: WriteAboutPhotoResponse;
  userId: string;
}): Promise<AiScore> {
  const { payload, response, userId } = args;
  const text = response.text.trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  const userMessage = `PHOTO (description, original to AlmiDET): ${payload.imageAlt}
TASK: Describe the photo in at least ${payload.minWords} words.
WORD COUNT: ${wordCount}

CANDIDATE RESPONSE:
"""
${text || "(empty)"}
"""

Rate it per the rules and return the JSON object.`;

  const client = getAnthropicClient();
  const startedAt = Date.now();
  let feedback: WriteAboutPhotoFeedback;
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
    const raw = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    feedback = feedbackSchema.parse(extractJson(raw));
  } catch (err) {
    await recordCost({
      userId,
      feature: "write-about-photo.evaluate",
      model: MODELS.SONNET,
      usage,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const costCents = await recordCost({
    userId,
    feature: "write-about-photo.evaluate",
    model: MODELS.SONNET,
    usage,
    success: true,
  });

  // Trait read → conservative fraction, with an honest under-length penalty.
  let fraction =
    (LEVEL_VALUE[feedback.taskRelevance] +
      LEVEL_VALUE[feedback.rangeAndAccuracy] +
      LEVEL_VALUE[feedback.clarity]) /
    3;
  if (payload.minWords > 0 && wordCount < payload.minWords * 0.6) {
    fraction *= 0.5; // well under length is a real limitation
  }

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
