// Seeds original "Read and Select" items. The test-taker marks the real English
// words and leaves the invented ones unmarked. All words are original to
// AlmiDET — never copied from Duolingo.
//
// AUTHORING RULES (enforced by `npm run gate:degame`, do not hand-wave them):
//   · Difficulty is REAL, not a label. Each pool draws only from its own CEFR
//     vocabulary band, and the invented words match that band's phonetic feel —
//     short and simple at FOUNDATION, Latinate at STRETCH.
//   · Every one of the 18 real/invented masks is DISTINCT, each of the 8 slots
//     is real 30-70% of the time, the real-word count varies 3-6, and no run
//     shape repeats across half the set. An earlier version of this file used
//     one identical mask for all 18 items, so selecting slots 1,3,5,7,8 scored
//     100% without reading a word.
//   · Every "real" word is confirmed present in an English word list and every
//     "invented" word confirmed absent from it.
//   · No invented word sits within 2 edits of — or shares a 5-character stem
//     with — a word keyed REAL anywhere in this task type. "nopple" next to a
//     keyed "apple" tests our spelling choices, not English. Lures whose real
//     counterpart is NOT keyed in the set (sagacitous, garrulent, perspicuant,
//     deliberous, judicorous, pellucidate) are fair and are kept deliberately.
//
// Run: npm run seed:read-select  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

const prisma = new PrismaClient();

type W = { id: string; text: string; real: boolean };
const words = (list: [string, boolean][]): W[] =>
  list.map(([text, real], i) => ({ id: `w${i + 1}`, text, real }));

type Level = "FOUNDATION" | "CORE" | "STRETCH";

// Instruction and coaching note are per level, so the wording matches the
// vocabulary the taker is actually facing.
const PROMPT: Record<Level, string> = {
  FOUNDATION:
    "Some of these are real English words and some are made up. Tap only the ones that are real.",
  CORE:
    "Mark every entry below that is a genuine English word. The rest have been invented.",
  STRETCH:
    "Only some of these are genuine English words. Select those; leave the invented forms unmarked.",
};

const GUIDANCE: Record<Level, string> = {
  FOUNDATION:
    "Sound each one out. If it looks like something you have seen in class or at home, it is probably real.",
  CORE:
    "Invented forms often borrow endings you already know. Trust the whole shape, not just how it finishes.",
  STRETCH:
    "At this level the invented forms are built from Latin-looking pieces. Judge the complete form, not its parts.",
};

const TOPIC: Record<Level, string> = {
  FOUNDATION: "everyday-vocabulary",
  CORE: "general-vocabulary",
  STRETCH: "academic-vocabulary",
};

function item(
  title: string,
  difficulty: Level,
  list: [string, boolean][],
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "READ_AND_SELECT",
    title,
    prompt: PROMPT[difficulty],
    difficulty,
    topicTag: TOPIC[difficulty],
    payload: { words: words(list) },
    guidanceNote: GUIDANCE[difficulty],
  };
}

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
  // ---- FOUNDATION ----
  item("Everyday words — A1", "FOUNDATION", [
    ["fremble", false], ["pemble", false],
    ["happy", true], ["flimper", false],
    ["yellow", true], ["jomber", false],
    ["pocket", true], ["glonket", false],
  ]),
  item("Everyday words — A2", "FOUNDATION", [
    ["bimmock", false], ["brimmet", false],
    ["school", true], ["crodge", false],
    ["table", true], ["morning", true],
    ["dombit", false], ["cratell", false],
  ]),
  item("Everyday words — A3", "FOUNDATION", [
    ["murnel", false], ["bread", true],
    ["narvic", false], ["house", true],
    ["water", true], ["dorlet", false],
    ["grummel", false], ["river", true],
  ]),
  item("Everyday words — A4", "FOUNDATION", [
    ["music", true], ["splunt", false],
    ["plodkin", false], ["krelly", false],
    ["window", true], ["winter", true],
    ["sister", true], ["quembo", false],
  ]),
  item("Everyday words — A5", "FOUNDATION", [
    ["quilber", false], ["chair", true],
    ["friend", true], ["tewdle", false],
    ["pencil", true], ["rabbit", true],
    ["apple", true], ["lorbit", false],
  ]),
  item("Everyday words — A6", "FOUNDATION", [
    ["parvit", false], ["kitchen", true],
    ["candle", true], ["garden", true],
    ["flower", true], ["basket", true],
    ["jinket", false], ["gippet", false],
  ]),
  // ---- CORE ----
  item("General vocabulary — B1", "CORE", [
    ["kelvary", false], ["protect", true],
    ["quintrel", false], ["arrange", true],
    ["blornic", false], ["picture", true],
    ["brimolic", false], ["tervane", false],
  ]),
  item("General vocabulary — B2", "CORE", [
    ["quandric", false], ["benefit", true],
    ["yarnest", false], ["condrel", false],
    ["jorvath", false], ["quality", true],
    ["honest", true], ["familiar", true],
  ]),
  item("General vocabulary — B3", "CORE", [
    ["weather", true], ["ulmanic", false],
    ["government", true], ["generous", true],
    ["pelvane", false], ["sprodge", false],
    ["nostrel", false], ["respond", true],
  ]),
  item("General vocabulary — B4", "CORE", [
    ["environment", true], ["berrantic", false],
    ["opportunity", true], ["sorvent", false],
    ["measure", true], ["halvicent", false],
    ["vodric", false], ["achieve", true],
  ]),
  item("General vocabulary — B5", "CORE", [
    ["grendale", false], ["travel", true],
    ["market", true], ["ordanic", false],
    ["decision", true], ["remember", true],
    ["wombrel", false], ["evantic", false],
  ]),
  item("General vocabulary — B6", "CORE", [
    ["murvane", false], ["purpose", true],
    ["rembold", false], ["discover", true],
    ["sincere", true], ["experience", true],
    ["improve", true], ["lomberic", false],
  ]),
  // ---- STRETCH ----
  item("Academic vocabulary — C1", "STRETCH", [
    ["threshold", true], ["circumvane", false],
    ["tenebrient", false], ["resplendicate", false],
    ["coherent", true], ["brelmontic", false],
    ["contradicent", false], ["pragmatic", true],
  ]),
  item("Academic vocabulary — C2", "STRETCH", [
    ["nuance", true], ["perspicuant", false],
    ["quiescible", false], ["eloquent", true],
    ["articulate", true], ["exorbicate", false],
    ["fastidion", false], ["judicorous", false],
  ]),
  item("Academic vocabulary — C3", "STRETCH", [
    ["ambiguous", true], ["garrulent", false],
    ["ubiquitous", true], ["sceptical", true],
    ["ambivature", false], ["prevalent", true],
    ["vandrelose", false], ["sagacitous", false],
  ]),
  item("Academic vocabulary — C4", "STRETCH", [
    ["ephemeral", true], ["profound", true],
    ["scrutiny", true], ["fendrolic", false],
    ["zealotrous", false], ["resilient", true],
    ["elucidorous", false], ["deliberous", false],
  ]),
  item("Academic vocabulary — C5", "STRETCH", [
    ["wendelo", false], ["blensome", false],
    ["tarnical", false], ["discern", true],
    ["obstruvent", false], ["versatile", true],
    ["notorious", true], ["cohesive", true],
  ]),
  item("Academic vocabulary — C6", "STRETCH", [
    ["susceptible", true], ["inevitable", true],
    ["persuasive", true], ["pellucidate", false],
    ["tangible", true], ["quiddlesome", false],
    ["meticulous", true], ["reluctant", true],
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

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
