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

// ---- READ AND COMPLETE (cloze) ----
// The passage renders as tokens joined by a single space. A "blank" token shows
// `visiblePrefix` followed by one underscore per missing letter; the test-taker
// types the rest of the word.
//
// SERVER-ONLY on a blank: `missingLetters` and `alsoAccept`. Both are the key.
// `blankLength` (the count, not the letters) IS projected — real DET renders one
// underscore per missing letter, so the length is part of the stimulus.
export type ReadAndCompleteToken =
  | { kind: "text"; text: string }
  | {
      kind: "blank";
      id: string;
      visiblePrefix: string;
      /** SERVER-ONLY — the keyed completion. */
      missingLetters: string;
      /** SERVER-ONLY — other completions that fit the letters AND the sentence.
       *  Marking a valid, context-fitting English word wrong would be unfair, and
       *  most prefixes admit several dictionary words. */
      alsoAccept?: string[];
      /** Punctuation riding the word, e.g. "," or "." — rendered, not typed. */
      suffix?: string;
    };

export type ReadAndCompletePayload = { passage: ReadAndCompleteToken[] };
export type ReadAndCompleteResponse = { filled: Record<string, string> };

// ---- INTERACTIVE READING ----
// One passage plus an ordered set of selection-based sub-questions (~6). All
// five sub-kinds are graded by id match, so the whole type is deterministic.
//
// THE PASSAGE IS ALWAYS STORED AS SPANS, one per sentence, whether or not any
// question targets a given sentence. Highlight the Answer asks the taker to
// select a region; if only the region CONTAINING the answer were marked up, the
// markup itself would give it away. Uniform spans mean the passage renders
// identically for all five sub-kinds and the selectable units carry no signal.
//
// SERVER-ONLY on every question: `correctId` / `correctSpanId`.

export type IRSubKind =
  | "COMPLETE_THE_SENTENCES"
  | "COMPLETE_THE_PASSAGE"
  | "HIGHLIGHT_THE_ANSWER"
  | "IDENTIFY_THE_IDEA"
  | "TITLE_THE_PASSAGE";

export type IROption = { id: string; text: string };
export type IRSpan = { id: string; text: string };

export type IRSelectQuestion = {
  kind: Exclude<IRSubKind, "HIGHLIGHT_THE_ANSWER">;
  id: string;
  /** The question, or the sentence carrying the gap. */
  stem: string;
  options: IROption[];
  /** SERVER-ONLY. */
  correctId: string;
};

export type IRHighlightQuestion = {
  kind: "HIGHLIGHT_THE_ANSWER";
  id: string;
  stem: string;
  /** SERVER-ONLY — refers to a span in passage.spans. */
  correctSpanId: string;
};

export type IRQuestion = IRSelectQuestion | IRHighlightQuestion;

export type InteractiveReadingPayload = {
  passage: { spans: IRSpan[] };
  questions: IRQuestion[];
};

/** questionId -> chosen optionId (select kinds) or spanId (highlight). */
export type InteractiveReadingResponse = { chosen: Record<string, string> };

export type ListenAndTypePayload = { sentence: string; audioScript?: string };
export type ListenAndTypeResponse = { typed: string };

// SERVER-ONLY FIELD, both photo tasks: `imageAlt` is the scene description the
// AI rater judges the response against — an answer key in prose form, not
// decoration. It must never be projected to the client; see
// src/lib/det/client-payload.ts, which withholds it, and gate:leak, which
// proves it stays withheld. The <img> alt text comes from the item title.

export type WriteAboutPhotoPayload = {
  imageUrl: string;
  /** Server-only — the rater's target. Never sent to the browser. */
  imageAlt: string;
  minWords: number;
};
export type WriteAboutPhotoResponse = { text: string };

export type SpeakAboutPhotoPayload = {
  imageUrl: string;
  /** Server-only — the rater's target. Never sent to the browser. */
  imageAlt: string;
  prepSeconds: number;
  speakSeconds: number;
};
export type SpeakAboutPhotoResponse = { transcript: string };
