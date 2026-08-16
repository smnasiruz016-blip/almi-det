// Seeds original "Interactive Writing" items — two linked prompts, Part 1 final
// before Part 2 is known.
//
// ONE REFERENCE ITEM. It proves the pipeline end to end — payload shape,
// progressive projection, stage lock, shared rater, both gates — before the rest
// are authored against it.
//
// AUTHORING CONTRACT — enforced by gate:writing-prompts and gate:writing-leak:
//   · Both parts carry a non-empty prompt, and part1 != part2. A follow-up that
//     restates the first prompt is not a second task.
//   · Part 2 must DEPEND on Part 1. The pair only works if the follow-up asks
//     for something that cannot be pre-written: concede the other side, mitigate
//     the downside YOU raised. If Part 2 stands alone, the lock protects nothing
//     and this is two unrelated essays sharing an item.
//   · `rubric.reference` is SERVER-ONLY — the rater's target in prose. Never
//     projected, and no prompt may quote it.
//   · No prompt may repeat another item's prompt anywhere in the bank.
//
// Run: npm run seed:interactive-writing  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredInteractiveWriting, type IWSource } from "./interactive-writing.loader";

const prisma = new PrismaClient();

const PROMPT = "Answer both parts. Part 1 locks when you submit it.";

const GUIDANCE =
  "Take a clear position in Part 1 and support it with specific examples. Part 2 is not a reversal — it asks you to be fair to the other side and practical about your own objection.";

/** The reference item, authored inline and proven end to end before the rest
 *  were written. Kept here rather than folded into the data file: it is the
 *  worked example the authoring contract above describes, and the gate fixtures
 *  are derived from it. */
const REFERENCE: Prisma.DetItemCreateManyInput[] = [
  {
    taskType: "INTERACTIVE_WRITING",
    title: "Working from home — preference and counter-case",
    prompt: PROMPT,
    difficulty: "CORE",
    topicTag: "Working from home",
    guidanceNote: GUIDANCE,
    payload: {
      topic: "Working from home",
      register: "general",
      part1: {
        prompt:
          "Some people prefer working from home, while others prefer working in an office. Which do you prefer, and why? Give specific reasons and examples.",
        minWords: 40,
      },
      part2: {
        prompt:
          "Now think about the opposite choice. Describe one real advantage of the option you did NOT pick, and suggest how someone could deal with the downside you mentioned in Part 1.",
        minWords: 25,
      },
      rubric: {
        traits: [
          "Task response",
          "Coherence & organisation",
          "Vocabulary range",
          "Grammatical accuracy",
        ],
        reference:
          "A strong answer states a clear preference in Part 1 with two specific, developed reasons, then in Part 2 fairly concedes one genuine advantage of the other option and offers a realistic way to mitigate the earlier downside. Register consistent; ideas connected.",
      },
    } as unknown as Prisma.InputJsonValue,
  },
];

// Cowork's authored items, when the data file has been dropped in. Absent = the
// reference alone, which is exactly the state this type shipped in.
const authored = loadAuthoredInteractiveWriting({
  prompt: PROMPT,
  guidanceNote: GUIDANCE,
  reservedTitles: REFERENCE.map((i) => i.title),
});

/** Where the bank came from. Printed by `npm run seed:writing-check` so "1 item"
 *  never gets mistaken for "12 items and the gates passed". */
export const IW_SOURCE: IWSource & { referenceCount: number; totalCount: number } = {
  ...authored.source,
  referenceCount: REFERENCE.length,
  totalCount: REFERENCE.length + authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = [...REFERENCE, ...authored.items];

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "INTERACTIVE_WRITING" } });
  if (existing > 0) {
    console.log(`Already ${existing} Interactive Writing item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Interactive Writing item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
