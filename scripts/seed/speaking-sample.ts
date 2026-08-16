// Seeds original "Speaking Sample" items.
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
// Run: npm run seed:speaking-sample  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredSpeakingSample, type SpeakingSampleSource } from "./speaking-sample.loader";

const prisma = new PrismaClient();

const PROMPT = "Speak on the topic for up to three minutes.";

const GUIDANCE =
  "Three minutes is long — plan a shape before you start. Two developed points beat six mentioned ones.";

const authored = loadAuthoredSpeakingSample({ prompt: PROMPT, guidanceNote: GUIDANCE, reservedTitles: [] });

/** Where the bank came from. Printed by `npm run seed:speaking-check`. */
export const SPEAKING_SAMPLE_SOURCE: SpeakingSampleSource & { totalCount: number } = {
  ...authored.source,
  totalCount: authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = authored.items;

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "SPEAKING_SAMPLE" } });
  if (existing > 0) {
    console.log(`Already ${existing} Speaking Sample item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Speaking Sample item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
