// Seeds original "Read and Select" items. Each item mixes real English words
// with invented non-words; the test-taker marks the real ones. All words are
// original to AlmiDET — never copied from Duolingo.
//
// Run: npm run seed:read-select  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type W = { id: string; text: string; real: boolean };
const words = (list: [string, boolean][]): W[] =>
  list.map(([text, real], i) => ({ id: `w${i + 1}`, text, real }));

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  {
    taskType: "READ_AND_SELECT",
    title: "Real words — set A",
    prompt: "Some of these are real English words and some are invented. Mark only the real ones.",
    difficulty: "FOUNDATION",
    topicTag: "everyday",
    payload: {
      words: words([
        ["garden", true],
        ["blorn", false],
        ["river", true],
        ["tewd", false],
        ["happy", true],
        ["grummel", false],
        ["table", true],
        ["pencil", true],
      ]),
    },
    guidanceNote: "Quick recognition — trust the spelling patterns you know.",
  },
  {
    taskType: "READ_AND_SELECT",
    title: "Real words — set B",
    prompt: "Some of these are real English words and some are invented. Mark only the real ones.",
    difficulty: "CORE",
    topicTag: "everyday",
    payload: {
      words: words([
        ["weather", true],
        ["flope", false],
        ["honest", true],
        ["tarnic", false],
        ["picture", true],
        ["quemp", false],
        ["market", true],
        ["travel", true],
      ]),
    },
    guidanceNote: "Watch for invented words that copy real spelling patterns.",
  },
  {
    taskType: "READ_AND_SELECT",
    title: "Real words — set C",
    prompt: "Some of these are real English words and some are invented. Mark only the real ones.",
    difficulty: "STRETCH",
    topicTag: "academic",
    payload: {
      words: words([
        ["deliberate", true],
        ["sprodge", false],
        ["scenery", true],
        ["crundle", false],
        ["manuscript", true],
        ["vorthly", false],
        ["hesitant", true],
        ["voyage", true],
      ]),
    },
    guidanceNote: "Longer words — sound them out to catch the invented ones.",
  },
];

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "READ_AND_SELECT" } });
  if (existing > 0) {
    console.log(`Already ${existing} Read and Select items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Read and Select items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
