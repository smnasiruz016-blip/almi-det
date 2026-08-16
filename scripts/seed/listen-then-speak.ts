// Seeds original "Listen Then Speak" items.
//
// ALL CONTENT COMES FROM THE DATA FILE via the shared loader; there is no inline
// reference item, because the payload shape is the data file's own example.
//
// SERVER-ONLY: `rubric.reference` — the rater's target in prose, an answer key
// under another name. Never projected; gate:speaking-leak proves it.
//
// ALSO SERVER-ONLY: `question`. It is delivered as AUDIO, so printing it would
// turn a listening-and-speaking item into a reading-and-speaking one. The clip
// is pre-rendered into DetItemAudio at deploy time, like the Interactive
// Listening segments.
//
// COST. Every attempt costs one Whisper call plus one rater call, both metered
// under this type's own ledger labels, and bounded by SPEAKING_DAILY_CAP.
//
// Run: npm run seed:listen-then-speak  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredListenThenSpeak, type ListenThenSpeakSource } from "./listen-then-speak.loader";

const prisma = new PrismaClient();

const PROMPT = "Listen to the question, then answer it aloud for up to 90 seconds.";

const GUIDANCE =
  "You hear the question once and there is no text. Answer what was asked, and develop one or two ideas rather than listing many.";

const authored = loadAuthoredListenThenSpeak({ prompt: PROMPT, guidanceNote: GUIDANCE, reservedTitles: [] });

/** Where the bank came from. Printed by `npm run seed:speaking-check`. */
export const LISTEN_THEN_SPEAK_SOURCE: ListenThenSpeakSource & { totalCount: number } = {
  ...authored.source,
  totalCount: authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = authored.items;

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "LISTEN_THEN_SPEAK" } });
  if (existing > 0) {
    console.log(`Already ${existing} Listen Then Speak item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Listen Then Speak item(s).`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
