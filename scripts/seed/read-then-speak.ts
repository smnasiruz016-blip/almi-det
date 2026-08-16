// Seeds original "Read Then Speak" items.
//
// ALL CONTENT COMES FROM THE DATA FILE via the shared loader; there is no inline
// reference item, because the payload shape is the data file's own example.
//
// SERVER-ONLY: `rubric.reference` — the rater's target in prose, an answer key
// under another name. Never projected; gate:speaking-leak proves it.
//
// The prompt IS shown — reading it is not the skill under test here.
//
// COST. Every attempt costs one Whisper call plus one rater call, both metered
// under this type's own ledger labels, and bounded by SPEAKING_DAILY_CAP.
//
// Run: npm run seed:read-then-speak  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredReadThenSpeak, type ReadThenSpeakSource } from "./read-then-speak.loader";

const prisma = new PrismaClient();

const PROMPT = "Read the prompt, then speak about it for up to 90 seconds.";

const GUIDANCE =
  "Give a clear position and develop two ideas. We rate what you said from a transcript — the ideas, flow, words and grammar — not your accent.";

const authored = loadAuthoredReadThenSpeak({ prompt: PROMPT, guidanceNote: GUIDANCE, reservedTitles: [] });

/** Where the bank came from. Printed by `npm run seed:speaking-check`. */
export const READ_THEN_SPEAK_SOURCE: ReadThenSpeakSource & { totalCount: number } = {
  ...authored.source,
  totalCount: authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = authored.items;

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "READ_THEN_SPEAK" } });
  if (existing > 0) {
    console.log(`Already ${existing} Read Then Speak item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Read Then Speak item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
