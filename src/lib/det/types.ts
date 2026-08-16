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

// ---- INTERACTIVE LISTENING ----
// One conversation, three sub-parts, all keyed off the SAME scenario:
//
//   A  Listen and Complete   short audio; a transcript with 3-4 WHOLE-WORD gaps
//                            the taker types. The audio supplies the word, so —
//                            unlike the reading cloze types — NO prefix is
//                            revealed and no blank length is projected. Showing
//                            either would turn a listening item into a spelling
//                            puzzle solvable without the audio.
//   B  Listen and Respond    5-6 turns. Each turn plays the other speaker once
//                            and the taker picks the best reply. Turn 1 is an
//                            OPENER: no audio, no line — "pick the best way to
//                            start", which is why `seg` and `line` are nullable.
//   C  Summarize             free text, AI-graded against a server-only
//                            reference and key points.
//
// SERVER-ONLY, and every one of them is an answer key or the test itself:
//   turn.line          the audio's own words — printing it removes the listening
//   turn.correct       the key
//   summarize.reference / keyPoints    what the AI rater marks against
//   complete.text[].missing            the key
//   complete.audioScript               what the voice actually says
//
// AUDIO SEGMENTS. `seg` is authored as a LABEL ("scenario", "turn-2") because a
// label survives reordering and reads honestly in a seed file. DetItemAudio keys
// on an INTEGER (itemId, seg), so segLabelToNumber() maps the two — "scenario"
// to 0 and "turn-N" to N. The mapping is total and injective, which is what lets
// this task type reuse the existing audio table with no migration.

export type ILScenario = {
  register: string;
  setting: string;
  speakerName: string;
  youAre: string;
};

/** A literal chunk of transcript, or THE gap. Spacing lives in the literal
 *  chunks, so the transcript is the pieces concatenated with nothing between —
 *  which is also what keeps a gap a whole word rather than a word fragment. */
export type ILCompleteChunk = string | { missing: string; alsoAccept?: string[] };

export type ILComplete = {
  /** Audio segment label for the scenario clip. */
  seg: string;
  text: ILCompleteChunk[];
  /** SERVER-ONLY — overrides what the voice speaks. Absent means "speak the
   *  transcript as written". When present it must still contain every blanked
   *  word verbatim, or the item is unanswerable as spoken; gate:il-cloze-audio
   *  is what proves that. */
  audioScript?: string;
};

export type ILTurn = {
  /** Audio segment label, or null for the opener (which has no audio). */
  seg: string | null;
  /** True on the one turn that opens the conversation. */
  opener?: boolean;
  /** SERVER-ONLY — what the other speaker says. This IS the listening test. */
  line: string | null;
  options: string[];
  /** SERVER-ONLY — index into `options` as AUTHORED, before shuffling. */
  correct: number;
};

export type ILSummarize = {
  prompt: string;
  /** SERVER-ONLY — the rater's target, an answer key in prose form. */
  reference: string;
  /** SERVER-ONLY — the points the rater checks for. */
  keyPoints: string[];
};

export type InteractiveListeningPayload = {
  scenario: ILScenario;
  complete: ILComplete;
  turns: ILTurn[];
  summarize: ILSummarize;
};

/** `chosen` is keyed by turn index and holds the DISPLAYED option position, not
 *  the authored one and never the key itself — the browser is never told which
 *  option is correct, so it cannot post it back. The server re-derives the same
 *  permutation from the payload and maps the position home. */
export type InteractiveListeningResponse = {
  filled: Record<string, string>;
  chosen: Record<string, number>;
  summary: string;
};

// ---- INTERACTIVE WRITING (Writing, AI) ----
// Two prompts answered in sequence. Part 1 is a position; Part 2 asks the taker
// to argue the other side and mitigate their own earlier downside.
//
// PART 2's PROMPT IS SERVER-ONLY UNTIL PART 1 IS SUBMITTED. Not because it is an
// answer key — it is not — but because knowing it changes Part 1. A taker who
// can read "now describe an advantage of the option you did NOT pick" will hedge
// Part 1 into something easy to reverse, and the task stops measuring what it
// measures. Same locked-progressive delivery as Interactive Listening, same
// machinery (src/lib/det/staged.ts).
//
// SERVER-ONLY throughout: `rubric.reference`. It is the rater's target in prose
// form — an answer key wearing a different name, exactly like the photo tasks'
// `imageAlt`.

export type WritingRubric = {
  /** Trait names the rater reports against. Safe to show AFTER scoring. */
  traits: string[];
  /** SERVER-ONLY — what a strong answer does. The rater's target. */
  reference: string;
};

export type InteractiveWritingPart = {
  prompt: string;
  minWords: number;
};

export type InteractiveWritingPayload = {
  topic: string;
  register: string;
  part1: InteractiveWritingPart;
  /** SERVER-ONLY until Part 1 is recorded. */
  part2: InteractiveWritingPart;
  rubric: WritingRubric;
};

/** `text` is keyed "part1" / "part2" — the same StoredAnswers.text bag every
 *  staged task writes into. */
export type InteractiveWritingResponse = {
  text: Record<string, string>;
};

// ---- WRITING SAMPLE (Writing, AI) ----
// One prompt, 30 seconds to read it with the textarea disabled, then 5 minutes
// to write ~100-130+ words. Single submission — not staged.
//
// HONESTY NOTE, and it is required on screen: in the official DET this sample is
// sent to institutions UNSCORED. We rate it because this is a practice product
// and feedback is the whole point, but claiming or implying that the real test
// scores it would be a lie about the exam. WRITING_SAMPLE_NOTE carries that
// sentence and the projection always emits it.
//
// SERVER-ONLY: `rubric.reference`, for the same reason as above.

export type WritingSamplePayload = {
  category: string;
  topic: string;
  prompt: string;
  /** Free text, e.g. "100–130+" — a target shown to the taker, never a gate. */
  targetWords: string;
  rubric: WritingRubric;
};

export type WritingSampleResponse = { text: string };
