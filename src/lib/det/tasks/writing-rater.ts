// The shared AI rater for the two rubric-based Writing task types.
//
// Interactive Writing and Writing Sample are graded on the SAME four traits
// against the SAME honesty rules, so there is one rater rather than two that
// drift. What each caller supplies is the material: the prompt(s), what the
// taker wrote, and the server-only reference describing what a strong answer
// does.
//
// WHY FOUR TRAITS AND NOT THE PHOTO TASK'S THREE. Write About the Photo reports
// taskRelevance / rangeAndAccuracy / clarity, which is the right read for "does
// this describe the picture". These two are rubric-driven writing tasks whose
// rubric names four: Task response, Coherence & organisation, Vocabulary range,
// Grammatical accuracy. Folding four into three would report a trait the rubric
// does not have and hide two it does.
//
// WHAT IS SHARED: the TRAIT vocabulary, the level->number scale, the JSON
// extractor, and the metering. All imported from write-about-the-photo rather
// than restated, so changing the trait scale changes every rater at once
// instead of one of them.

import { z } from "zod";
import { getAnthropicClient, recordCost } from "@/lib/ai/anthropic-client";
import { MODELS } from "@/lib/ai/models";
import { LEVEL_VALUE, extractJson } from "@/lib/det/tasks/write-about-the-photo";

const TRAIT = z.enum(["strong", "adequate", "limited"]);

export const writingFeedbackSchema = z.object({
  taskResponse: TRAIT,
  coherence: TRAIT,
  vocabulary: TRAIT,
  grammar: TRAIT,
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  overallComment: z.string(),
});

export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;

/** Rubric trait name -> the key the rater returns. Exported so the review screen
 *  labels a trait with the rubric's own words rather than a second vocabulary. */
export const WRITING_TRAIT_KEYS = [
  "taskResponse",
  "coherence",
  "vocabulary",
  "grammar",
] as const;

export const WRITING_TRAIT_LABEL: Record<string, string> = {
  taskResponse: "Task response",
  coherence: "Coherence & organisation",
  vocabulary: "Vocabulary range",
  grammar: "Grammatical accuracy",
};

const SYSTEM = `You are an honest writing coach for AlmiDET, a Duolingo English Test (DET) practice tool.

You rate a short written practice response against a rubric. Rules:
- All content here is original to AlmiDET. Never reference or reproduce real Duolingo test material.
- This is a PRACTICE ESTIMATE, not an official DET result. Never state a DET score or number, and never promise a score.
- Judge what was actually written against the task set. Reward specific, developed ideas over length.
- Copying the prompt's wording back is not task response. Say so plainly if it happens.
- Be honest and constructive. If the writing is limited, say so kindly. Do not inflate.
- Banned words: "weak", "poor", "wrong", "failed". Prefer "improvement opportunity".

Return ONLY a JSON object, no prose around it, with exactly these keys:
{
  "taskResponse": "strong" | "adequate" | "limited",   // does it answer the task set, with developed ideas
  "coherence": "strong" | "adequate" | "limited",      // organisation, connection between ideas
  "vocabulary": "strong" | "adequate" | "limited",     // range and precision of word choice
  "grammar": "strong" | "adequate" | "limited",        // accuracy and range of structures
  "strengths": string[],        // 1-3 short, specific
  "improvements": string[],     // 1-3 short, specific, actionable
  "overallComment": string      // one or two honest sentences
}`;

export type WritingScore = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  feedback: WritingFeedback;
  telemetry: { aiModel: string; costCents: number; latencyMs: number };
};

/**
 * Rate a written response.
 *
 * `sections` is one entry per thing the taker wrote — one for Writing Sample,
 * two for Interactive Writing. Passing them separately rather than concatenated
 * lets the rater see which prompt each answer belongs to, which is the whole
 * point of a two-part task where Part 2 must engage with Part 1.
 */
export async function evaluateWriting(args: {
  feature: string;
  pointsMax: number;
  /** SERVER-ONLY — what a strong answer does. Never projected. */
  reference: string;
  context: string;
  sections: { label: string; prompt: string; text: string; minWords?: number }[];
  /** Total words below which the response is treated as under-length. */
  minTotalWords: number;
  userId: string;
}): Promise<WritingScore> {
  const { feature, pointsMax, reference, context, sections, minTotalWords, userId } = args;

  const wordsIn = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const totalWords = sections.reduce((n, s) => n + wordsIn(s.text), 0);

  const userMessage = `${context}

WHAT A STRONG ANSWER DOES (reference — the candidate has never seen this):
"""
${reference}
"""

${sections
  .map(
    (s) =>
      `--- ${s.label} ---\nTASK: ${s.prompt}\n${
        s.minWords ? `MINIMUM WORDS: ${s.minWords}\n` : ""
      }WORDS WRITTEN: ${wordsIn(s.text)}\nCANDIDATE RESPONSE:\n"""\n${s.text.trim() || "(empty)"}\n"""`,
  )
  .join("\n\n")}

Rate the response as a whole per the rules and return the JSON object.`;

  const client = getAnthropicClient();
  const startedAt = Date.now();
  let feedback: WritingFeedback;
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

  try {
    const res = await client.messages.create({
      model: MODELS.SONNET,
      max_tokens: 700,
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
    feedback = writingFeedbackSchema.parse(extractJson(raw));
  } catch (err) {
    await recordCost({
      userId,
      feature,
      model: MODELS.SONNET,
      usage,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const costCents = await recordCost({
    userId,
    feature,
    model: MODELS.SONNET,
    usage,
    success: true,
  });

  let fraction =
    (LEVEL_VALUE[feedback.taskResponse] +
      LEVEL_VALUE[feedback.coherence] +
      LEVEL_VALUE[feedback.vocabulary] +
      LEVEL_VALUE[feedback.grammar]) /
    4;
  // Well under length is a real limitation, and the same 0.6 threshold the photo
  // rater uses — one rule for under-length across the product.
  if (minTotalWords > 0 && totalWords < minTotalWords * 0.6) fraction *= 0.5;

  return {
    pointsEarned: Math.round(fraction * pointsMax),
    pointsMax,
    fraction,
    feedback,
    telemetry: { aiModel: MODELS.SONNET, costCents, latencyMs: Date.now() - startedAt },
  };
}
