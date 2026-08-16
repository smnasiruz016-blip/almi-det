// The shared AI rater for the three rubric-based speaking types.
//
// WHAT IT RATES, AND THE ONE THING IT MUST NOT CLAIM.
//
// It sees a TRANSCRIPT. Not audio — a transcript, produced by Whisper, with the
// pauses, the intonation, the stress and every phoneme already thrown away. So
// it rates what survives that: whether the answer addresses the task, whether it
// holds together, and the range and accuracy of the language.
//
// It does NOT rate pronunciation, and the system prompt forbids it explicitly.
// A model handed a clean transcript will happily produce a confident sentence
// about someone's accent if you let it, and that sentence would be invented —
// the evidence for it was destroyed two steps upstream. Telling a learner their
// pronunciation is "limited" on no acoustic evidence is worse than telling them
// nothing.
//
// The one honest proxy we have is READ_ALOUD, which is deterministic: a known
// sentence, a transcript, and a count of which words came through. That measures
// intelligibility to a transcriber, which is a real and narrow thing. This rater
// stays out of it.
//
// FLUENCY IS RATED FROM THE TRANSCRIPT AND LABELLED AS SUCH. Sentence length,
// connective range and whether the answer develops or repeats are visible in
// text; hesitation and pace are not. The trait is called "Flow (from transcript)"
// on the review screen for that reason, the same wording Speak About the Photo
// already uses.
//
// Shared with write-about-the-photo: the TRAIT scale, the level->number values
// and the JSON extractor. Changing the scale changes every rater at once.

import { z } from "zod";
import { getAnthropicClient, recordCost } from "@/lib/ai/anthropic-client";
import { MODELS } from "@/lib/ai/models";
import { LEVEL_VALUE, extractJson } from "@/lib/det/tasks/write-about-the-photo";

const TRAIT = z.enum(["strong", "adequate", "limited"]);

export const speakingFeedbackSchema = z.object({
  taskResponse: TRAIT,
  fluencyOnTopic: TRAIT,
  vocabulary: TRAIT,
  grammar: TRAIT,
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  overallComment: z.string(),
});

export type SpeakingFeedback = z.infer<typeof speakingFeedbackSchema>;

export const SPEAKING_TRAIT_KEYS = [
  "taskResponse",
  "fluencyOnTopic",
  "vocabulary",
  "grammar",
] as const;

export const SPEAKING_TRAIT_LABEL: Record<string, string> = {
  taskResponse: "Task response",
  fluencyOnTopic: "Flow (from transcript)",
  vocabulary: "Vocabulary range",
  grammar: "Grammatical accuracy",
};

/** Shown to the taker wherever a spoken answer is rated. It is not a disclaimer
 *  in the legal sense — it is the accurate description of what was measured. */
export const SPEAKING_TRANSCRIPT_NOTE =
  "We rate what you said from a transcript of your recording — the ideas, the flow, the words and the grammar. We do not score your accent or pronunciation.";

const SYSTEM = `You are an honest speaking coach for AlmiDET, a Duolingo English Test (DET) practice tool.

You rate a spoken practice answer. You are given a TRANSCRIPT of the recording, never the audio.

Rules:
- All content here is original to AlmiDET. Never reference or reproduce real Duolingo test material.
- This is a PRACTICE ESTIMATE, not an official DET result. Never state a DET score or number.
- YOU CANNOT HEAR THE RECORDING. Never comment on pronunciation, accent, intonation, stress or
  audio quality, and never imply you assessed them. You have a transcript; the sound is gone.
- Rate "fluencyOnTopic" from what the TEXT shows — development, connectives, repetition, whether
  the answer keeps going somewhere. Not from pace or hesitation, which a transcript does not carry.
- Transcripts contain recognition errors. A single odd word is far more likely to be the
  transcriber than the speaker; do not build a judgement on one.
- Be honest and constructive. If the answer is limited, say so kindly. Do not inflate.
- Banned words: "weak", "poor", "wrong", "failed". Prefer "improvement opportunity".

Return ONLY a JSON object, no prose around it, with exactly these keys:
{
  "taskResponse": "strong" | "adequate" | "limited",
  "fluencyOnTopic": "strong" | "adequate" | "limited",
  "vocabulary": "strong" | "adequate" | "limited",
  "grammar": "strong" | "adequate" | "limited",
  "strengths": string[],
  "improvements": string[],
  "overallComment": string
}`;

export type SpeakingScore = {
  pointsEarned: number;
  pointsMax: number;
  fraction: number;
  feedback: SpeakingFeedback;
  telemetry: { aiModel: string; costCents: number; latencyMs: number };
};

const POINTS_MAX = 12;
/** Under this many words the answer is treated as too short to rate fully — the
 *  same shape of under-length penalty the writing raters apply. */
const MIN_WORDS = 30;

export async function evaluateSpokenResponse(args: {
  feature: string;
  /** SERVER-ONLY — what a strong answer does. Never projected. */
  reference: string;
  /** The task as the taker received it. For LISTEN_THEN_SPEAK this is the
   *  question text, which the taker HEARD but never saw. */
  task: string;
  context: string;
  transcript: string;
  userId: string;
}): Promise<SpeakingScore> {
  const { feature, reference, task, context, userId } = args;
  const transcript = args.transcript.trim();
  const wordCount = transcript ? transcript.split(/\s+/).length : 0;

  const userMessage = `${context}

TASK THE CANDIDATE ANSWERED:
"""
${task}
"""

WHAT A STRONG ANSWER DOES (reference — the candidate has never seen this):
"""
${reference}
"""

TRANSCRIPT OF THE RECORDING (${wordCount} words):
"""
${transcript || "(nothing was transcribed)"}
"""

Rate it per the rules and return the JSON object. Remember: you have not heard the audio.`;

  const client = getAnthropicClient();
  const startedAt = Date.now();
  let feedback: SpeakingFeedback;
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
    feedback = speakingFeedbackSchema.parse(extractJson(raw));
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
      LEVEL_VALUE[feedback.fluencyOnTopic] +
      LEVEL_VALUE[feedback.vocabulary] +
      LEVEL_VALUE[feedback.grammar]) /
    4;
  if (wordCount < MIN_WORDS) fraction *= 0.5;

  return {
    pointsEarned: Math.round(fraction * POINTS_MAX),
    pointsMax: POINTS_MAX,
    fraction,
    feedback,
    telemetry: { aiModel: MODELS.SONNET, costCents, latencyMs: Date.now() - startedAt },
  };
}
