// INTERACTIVE LISTENING — Part C, "Summarize the Conversation" (AI).
//
// The taker types a summary of the conversation they just worked through. The
// rater marks it against `summarize.reference` and `summarize.keyPoints`, both
// SERVER-ONLY: reference is an answer key in prose form and keyPoints is the
// same key itemised. Neither is ever projected; gate:il-leak proves it.
//
// The trait vocabulary, its numeric read and the JSON extractor are IMPORTED
// from write-about-the-photo rather than restated, so the two AI raters cannot
// drift apart. What is NOT shared is the prompt: a summary is judged on whether
// it captures the conversation's content, which a photo-description prompt does
// not ask about.
//
// Metered exactly like the photo rater — one AICostLedger row per call, and a
// row on failure too, so a burst of errored calls is visible in the ledger
// rather than invisible.

import { getAnthropicClient, recordCost } from "@/lib/ai/anthropic-client";
import { MODELS } from "@/lib/ai/models";
import {
  traitFeedbackSchema,
  LEVEL_VALUE,
  extractJson,
  type TraitFeedback,
} from "@/lib/det/tasks/write-about-the-photo";
import type { InteractiveListeningPayload } from "@/lib/det/types";

export const SUMMARY_POINTS_MAX = 6;
export const SUMMARY_FEATURE = "interactive-listening.summarize";

/** Well under the reference length is a real limitation, not a style choice. */
const MIN_SUMMARY_WORDS = 25;

const SYSTEM = `You are an honest listening coach for AlmiDET, a Duolingo English Test (DET) practice tool.

You rate a short "Summarize the Conversation" practice response. Rules:
- All content here is original to AlmiDET. Never reference or reproduce real Duolingo test material.
- This is a PRACTICE ESTIMATE, not an official DET result. Never state a DET score or number, and never promise a score.
- Judge whether the summary captures what actually happened in the conversation, in the candidate's OWN words. Copying the reference wording is not a strength.
- Be honest and constructive. If the summary is limited, say so plainly but kindly. Do not inflate.
- Banned words: "weak", "poor", "wrong", "failed". Prefer "improvement opportunity".
- Do not invent conversation details beyond the reference and key points provided.

Return ONLY a JSON object, no prose around it, with exactly these keys:
{
  "taskRelevance": "strong" | "adequate" | "limited",   // does it cover the key points of THIS conversation
  "rangeAndAccuracy": "strong" | "adequate" | "limited", // grammar + vocabulary range and control
  "clarity": "strong" | "adequate" | "limited",          // organisation + readability
  "strengths": string[],        // 1-3 short, specific
  "improvements": string[],     // 1-3 short, specific, actionable
  "overallComment": string      // one or two honest sentences
}`;

export type SummaryScore = {
  pointsEarned: number;
  pointsMax: number;
  feedback: TraitFeedback;
  telemetry: { aiModel: string; costCents: number; latencyMs: number };
};

export async function evaluateConversationSummary(args: {
  payload: InteractiveListeningPayload;
  summary: string;
  userId: string;
}): Promise<SummaryScore> {
  const { payload, userId } = args;
  const text = args.summary.trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  const userMessage = `CONVERSATION (original to AlmiDET)
Setting: ${payload.scenario.setting}
Speakers: ${payload.scenario.speakerName} (the other speaker) and ${payload.scenario.youAre} (the candidate)
Register: ${payload.scenario.register}

REFERENCE SUMMARY (the target — the candidate has never seen this):
"""
${payload.summarize.reference}
"""

KEY POINTS the summary should cover:
${payload.summarize.keyPoints.map((k, i) => `${i + 1}. ${k}`).join("\n")}

TASK GIVEN TO THE CANDIDATE: ${payload.summarize.prompt}
WORD COUNT: ${wordCount}

CANDIDATE RESPONSE:
"""
${text || "(empty)"}
"""

Rate it per the rules and return the JSON object.`;

  const client = getAnthropicClient();
  const startedAt = Date.now();
  let feedback: TraitFeedback;
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

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
    feedback = traitFeedbackSchema.parse(extractJson(raw));
  } catch (err) {
    await recordCost({
      userId,
      feature: SUMMARY_FEATURE,
      model: MODELS.SONNET,
      usage,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const costCents = await recordCost({
    userId,
    feature: SUMMARY_FEATURE,
    model: MODELS.SONNET,
    usage,
    success: true,
  });

  let fraction =
    (LEVEL_VALUE[feedback.taskRelevance] +
      LEVEL_VALUE[feedback.rangeAndAccuracy] +
      LEVEL_VALUE[feedback.clarity]) /
    3;
  if (wordCount < MIN_SUMMARY_WORDS) fraction *= 0.5;

  return {
    pointsEarned: Math.round(fraction * SUMMARY_POINTS_MAX),
    pointsMax: SUMMARY_POINTS_MAX,
    feedback,
    telemetry: { aiModel: MODELS.SONNET, costCents, latencyMs: Date.now() - startedAt },
  };
}
