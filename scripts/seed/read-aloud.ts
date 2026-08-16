// Seeds original "Read Aloud" sentences — the taker reads one aloud and the
// transcript is scored against it.
//
// ALL CONTENT COMES FROM THE DATA FILE. Unlike the other types there is no
// inline reference item: the payload is a single `{ text }`, so the data file is
// its own worked example.
//
// AUTHORING CONTRACT — enforced by gate:read-aloud-content:
//   · A real, non-empty sentence ending in terminal punctuation.
//   · Say-able in one breath — long enough to be a task, short enough that the
//     30-second recording limit is generous rather than tight.
//   · Every word ordinary English (or a capitalised proper noun): the taker is
//     reading aloud, and a word nobody can pronounce measures nothing.
//   · No duplicates anywhere in the bank.
//
// COST NOTE. Each attempt at this type costs exactly one Whisper call and no AI
// rater, which is why it is the first speaking type built. The per-user daily cap
// in src/lib/det/speaking.ts bounds how many of those one account can trigger.
//
// Run: npm run seed:read-aloud  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredReadAloud, type ReadAloudSource } from "./read-aloud.loader";

const prisma = new PrismaClient();

const PROMPT = "Read the sentence aloud, clearly and at a natural pace.";

const GUIDANCE =
  "Read it once, at a normal speaking pace. We check which words came through the recording — this is not a rating of your accent.";

const authored = loadAuthoredReadAloud({
  prompt: PROMPT,
  guidanceNote: GUIDANCE,
  reservedTitles: [],
});

/** Where the bank came from. Printed by `npm run seed:speaking-check`. */
export const READ_ALOUD_SOURCE: ReadAloudSource & { totalCount: number } = {
  ...authored.source,
  totalCount: authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = authored.items;

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "READ_ALOUD" } });
  if (existing > 0) {
    console.log(`Already ${existing} Read Aloud item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Read Aloud item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
