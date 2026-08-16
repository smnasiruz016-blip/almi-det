// Seeds original "Writing Sample" items — one prompt, 30s to read, 5 minutes to
// write ~100-130+ words.
//
// ONE REFERENCE ITEM, as with the other new types.
//
// WHAT THIS TYPE IS, HONESTLY. In the official DET the Writing Sample is sent to
// institutions UNSCORED — it is a work sample, not a graded task. This is a
// practice product, so we rate it for feedback and SAY SO on screen. The
// sentence lives in src/lib/det/tasks/writing-sample.ts as WRITING_SAMPLE_NOTE
// and travels in the projected payload, so a redesign of the composer cannot
// quietly drop it without gate:writing-leak noticing.
//
// AUTHORING CONTRACT — enforced by gate:writing-prompts and gate:writing-leak:
//   · A non-empty prompt long enough to set a real task, and short enough to
//     read inside the 30-second prep window.
//   · `rubric.reference` is SERVER-ONLY and never projected.
//   · No prompt may repeat another item's prompt anywhere in the bank.
//
// Run: npm run seed:writing-sample  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredWritingSample, type WSSource } from "./writing-sample.loader";

const prisma = new PrismaClient();

const PROMPT = "Read the prompt, then write your response.";

const GUIDANCE =
  "Name one idea and stay with it. Two developed reasons with concrete examples read far better than five ideas listed.";

/** The reference item, authored inline and proven end to end before the rest
 *  were written. The gate fixtures are derived from it. */
const REFERENCE: Prisma.DetItemCreateManyInput[] = [
  {
    taskType: "WRITING_SAMPLE",
    title: "One skill every student should learn",
    prompt: PROMPT,
    difficulty: "CORE",
    topicTag: "Education",
    guidanceNote: GUIDANCE,
    payload: {
      category: "academic",
      topic: "Education",
      prompt:
        "Describe one skill you believe every student should learn before finishing school. Explain why it matters and how schools could teach it effectively.",
      targetWords: "100–130+",
      rubric: {
        traits: [
          "Task response",
          "Coherence & organisation",
          "Vocabulary range",
          "Grammatical accuracy",
        ],
        reference:
          "A strong answer opens with a clear thesis naming one skill, develops two reasons with concrete examples, and closes with a brief forward-looking conclusion, ~100–130 words in an academic register.",
      },
    } as unknown as Prisma.InputJsonValue,
  },
];

// Cowork's authored items, when the data file has been dropped in. Absent = the
// reference alone, which is exactly the state this type shipped in.
const authored = loadAuthoredWritingSample({
  prompt: PROMPT,
  guidanceNote: GUIDANCE,
  reservedTitles: REFERENCE.map((i) => i.title),
});

/** Where the bank came from. Printed by `npm run seed:writing-check`. */
export const WS_SOURCE: WSSource & { referenceCount: number; totalCount: number } = {
  ...authored.source,
  referenceCount: REFERENCE.length,
  totalCount: REFERENCE.length + authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = [...REFERENCE, ...authored.items];

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "WRITING_SAMPLE" } });
  if (existing > 0) {
    console.log(`Already ${existing} Writing Sample item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Writing Sample item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
