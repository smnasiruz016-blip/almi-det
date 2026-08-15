// Seeds original "Interactive Reading" sets — one passage plus ~6 selection
// questions across five sub-kinds.
//
// EMPTY ON PURPOSE — the sets are authored separately. The task type is
// registered with `live: false` in src/lib/det/registry.ts until they land, so
// the practice hub shows "Coming soon" and MOCK_ORDER (derived from `live`)
// skips it. Flip `live` to true in the same change that fills ITEMS.
//
// AUTHORING CONTRACT — enforced by `npm run gate:reading-set`:
//   · ~6 questions per set; every sub-kind used somewhere in the bank.
//   · The passage is written as SENTENCES. Every sentence becomes a selectable
//     span, whether or not a question targets it — that uniformity is what stops
//     the markup from revealing the Highlight answer.
//   · >= 3 options per select question; exactly one correct; options distinct.
//   · The correct option must NOT be the longest option in most questions, and
//     the correct position must not concentrate — both are answerable without
//     reading.
//   · The correct option must not share distinctive words with the stem that the
//     distractors lack.
//   · Difficulty is passage VOCABULARY RARITY, not passage length.
//
// Run: npm run seed:interactive-reading  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

const prisma = new PrismaClient();

type Level = "FOUNDATION" | "CORE" | "STRETCH";

/** Authoring shorthand. `correct` names the option TEXT, so an author never
 *  hand-writes ids and the key cannot drift out of sync with the options. */
export type Select = {
  kind: "COMPLETE_THE_SENTENCES" | "COMPLETE_THE_PASSAGE" | "IDENTIFY_THE_IDEA" | "TITLE_THE_PASSAGE";
  stem: string;
  options: string[];
  correct: string;
};

/** `correctSentence` names the passage SENTENCE (1-based) that answers it. */
export type Highlight = {
  kind: "HIGHLIGHT_THE_ANSWER";
  stem: string;
  correctSentence: number;
};

export type Question = Select | Highlight;

export function build(sentences: string[], questions: Question[]): Prisma.InputJsonValue {
  const spans = sentences.map((text, i) => ({ id: `s${i + 1}`, text }));
  let n = 0;
  const qs = questions.map((q) => {
    const id = `q${++n}`;
    if (q.kind === "HIGHLIGHT_THE_ANSWER") {
      const span = spans[q.correctSentence - 1];
      if (!span) throw new Error(`${id}: correctSentence ${q.correctSentence} is out of range`);
      return { kind: q.kind, id, stem: q.stem, correctSpanId: span.id };
    }
    const options = q.options.map((text, i) => ({ id: `${id}o${i + 1}`, text }));
    const correct = options.find((o) => o.text === q.correct);
    if (!correct) throw new Error(`${id}: correct "${q.correct}" is not one of the options`);
    return { kind: q.kind, id, stem: q.stem, options, correctId: correct.id };
  });
  return { passage: { spans }, questions: qs } as unknown as Prisma.InputJsonValue;
}

const PROMPT: Record<Level, string> = {
  FOUNDATION: "Read the passage, then answer the questions about it.",
  CORE: "Read the passage carefully. Each question below refers to it.",
  STRETCH: "Read the passage, then answer the questions. Some ask what the writer means rather than what the writer says.",
};

const GUIDANCE: Record<Level, string> = {
  FOUNDATION: "Look back at the passage for every question. The answer is always there.",
  CORE: "When two choices both look possible, find the sentence that decides between them.",
  STRETCH: "Distinguish what is stated from what is implied; the best title covers the whole passage, not one paragraph.",
};

const TOPIC: Record<Level, string> = {
  FOUNDATION: "everyday-reading-set",
  CORE: "general-reading-set",
  STRETCH: "academic-reading-set",
};

export function item(
  title: string,
  difficulty: Level,
  sentences: string[],
  questions: Question[],
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "INTERACTIVE_READING",
    title,
    prompt: PROMPT[difficulty],
    difficulty,
    topicTag: TOPIC[difficulty],
    payload: build(sentences, questions),
    guidanceNote: GUIDANCE[difficulty],
  };
}

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
  // Authored sets go here — see the contract above.
];

async function main() {
  if (ITEMS.length === 0) {
    console.log("No Interactive Reading sets authored yet — nothing to seed.");
    return;
  }
  const existing = await prisma.detItem.count({ where: { taskType: "INTERACTIVE_READING" } });
  if (existing > 0) {
    console.log(`Already ${existing} Interactive Reading items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Interactive Reading items.`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
