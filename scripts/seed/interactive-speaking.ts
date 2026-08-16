// Seeds original "Interactive Speaking" interviews.
//
// ALL CONTENT COMES FROM THE DATA FILE via the shared loader.
//
// SERVER-ONLY: every `turns[].question`, and `rubric.reference`. The questions
// are not answer keys — they are the listening half of each turn, delivered as
// audio. Printing one would turn a spoken interview into a reading exercise.
//
// COST. One interview is ONE attempt against SPEAKING_DAILY_CAP and costs four
// transcriptions plus a SINGLE holistic rating. The turns are pre-authored, so
// nothing is generated at runtime.
//
// Run: npm run seed:interactive-speaking  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import {
  loadAuthoredInteractiveSpeaking,
  type InteractiveSpeakingSource,
} from "./interactive-speaking.loader";

const prisma = new PrismaClient();

const PROMPT = "Answer each question aloud. You hear each one once, and they come one at a time.";

const GUIDANCE =
  "Answer the question that was asked, then add one specific detail. Short, developed answers beat long, vague ones — and the interview is judged across all the turns together.";

const authored = loadAuthoredInteractiveSpeaking({
  prompt: PROMPT,
  guidanceNote: GUIDANCE,
  reservedTitles: [],
});

/** Where the bank came from. Printed by `npm run seed:speaking-check`. */
export const INTERACTIVE_SPEAKING_SOURCE: InteractiveSpeakingSource & { totalCount: number } = {
  ...authored.source,
  totalCount: authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = authored.items;

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "INTERACTIVE_SPEAKING" } });
  if (existing > 0) {
    console.log(`Already ${existing} Interactive Speaking item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Interactive Speaking item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
