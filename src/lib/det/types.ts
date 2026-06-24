// Shared DET domain primitives. The four skills and four integrated subscores
// follow the official Duolingo English Test reporting model (verified
// 2026-06-24): each subscore combines two skills. We never model a single
// "overall" — DET's overall is a proprietary adaptive estimate we do not
// reproduce.

export type DetSkill = "READING" | "WRITING" | "LISTENING" | "SPEAKING";

export type SubscoreKey =
  | "literacy" // Reading + Writing
  | "comprehension" // Reading + Listening
  | "conversation" // Speaking + Listening
  | "production"; // Speaking + Writing

export const SUBSCORE_KEYS: readonly SubscoreKey[] = [
  "literacy",
  "comprehension",
  "conversation",
  "production",
] as const;

export const SUBSCORE_LABEL: Record<SubscoreKey, string> = {
  literacy: "Literacy",
  comprehension: "Comprehension",
  conversation: "Conversation",
  production: "Production",
};

export const SUBSCORE_MEANING: Record<SubscoreKey, string> = {
  literacy: "Reading and writing in print",
  comprehension: "Understanding what you read and hear",
  conversation: "Real-time interactive exchange",
  production: "Producing language in speech and writing",
};

// A practice-estimate range on the 10–160 scale, always step-of-5 aligned.
export type Range = readonly [number, number];

// Per-subscore estimate; null = not enough evidence yet (skill not practised).
export type SubscoreEstimate = Record<SubscoreKey, Range | null>;

// ---- Per-task payload (stimulus + answer key) and response shapes ----
// payload lives on DetItem.payload; response on DetAttempt.response.

export type ReadAndSelectPayload = {
  words: { id: string; text: string; real: boolean }[];
};
export type ReadAndSelectResponse = { selected: string[] };

export type ListenAndTypePayload = { sentence: string; audioScript?: string };
export type ListenAndTypeResponse = { typed: string };

export type WriteAboutPhotoPayload = {
  imageUrl: string;
  imageAlt: string;
  minWords: number;
};
export type WriteAboutPhotoResponse = { text: string };

export type SpeakAboutPhotoPayload = {
  imageUrl: string;
  imageAlt: string;
  prepSeconds: number;
  speakSeconds: number;
};
export type SpeakAboutPhotoResponse = { transcript: string };
