// Seeds original "Read and Select" items across the three difficulty pools so
// the adaptive set has room to move. Each item mixes real English words with
// invented non-words; the test-taker marks the real ones. All words are
// original to AlmiDET — never copied from Duolingo.
//
// Run: npm run seed:read-select  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type W = { id: string; text: string; real: boolean };
const words = (list: [string, boolean][]): W[] =>
  list.map(([text, real], i) => ({ id: `w${i + 1}`, text, real }));

const PROMPT =
  "Some of these are real English words and some are invented. Mark only the real ones.";

function item(
  title: string,
  difficulty: "FOUNDATION" | "CORE" | "STRETCH",
  list: [string, boolean][],
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "READ_AND_SELECT",
    title,
    prompt: PROMPT,
    difficulty,
    topicTag: "vocabulary",
    payload: { words: words(list) },
    guidanceNote: "Trust the spelling patterns you know; invented words often copy real ones.",
  };
}

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  item("Real words — A1", "FOUNDATION", [
    ["garden", true], ["blornic", false], ["river", true], ["tewdle", false],
    ["happy", true], ["grummel", false], ["table", true], ["pencil", true],
  ]),
  item("Real words — A2", "FOUNDATION", [
    ["water", true], ["flopen", false], ["apple", true], ["denvil", false],
    ["green", true], ["morbick", false], ["house", true], ["friend", true],
  ]),
  item("Real words — A3", "FOUNDATION", [
    ["school", true], ["gruppen", false], ["bread", true], ["snodder", false],
    ["music", true], ["frunce", false], ["winter", true], ["orange", true],
  ]),
  item("Real words — B1", "CORE", [
    ["weather", true], ["tarnical", false], ["honest", true], ["quempo", false],
    ["picture", true], ["sprodge", false], ["market", true], ["travel", true],
  ]),
  item("Real words — B2", "CORE", [
    ["purpose", true], ["drazzle", false], ["reason", true], ["splound", false],
    ["notice", true], ["gorthen", false], ["village", true], ["promise", true],
  ]),
  item("Real words — B3", "CORE", [
    ["comfort", true], ["trunble", false], ["feature", true], ["blurnce", false],
    ["section", true], ["prendle", false], ["capture", true], ["reply", true],
  ]),
  item("Real words — C1", "STRETCH", [
    ["deliberate", true], ["vorthly", false], ["scenery", true], ["crundle", false],
    ["manuscript", true], ["flandor", false], ["hesitant", true], ["voyage", true],
  ]),
  item("Real words — C2", "STRETCH", [
    ["meticulous", true], ["quandle", false], ["eloquent", true], ["blensome", false],
    ["persuasive", true], ["wendelo", false], ["reluctant", true], ["threshold", true],
  ]),
  item("Real words — C3", "STRETCH", [
    ["ambiguous", true], ["plimber", false], ["coherent", true], ["gorphic", false],
    ["substantial", true], ["snarvle", false], ["nuance", true], ["inevitable", true],
  ]),
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
