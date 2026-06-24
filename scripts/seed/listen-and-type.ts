// Seeds original "Listen and Type" items across the three difficulty pools.
// The `sentence` is the answer key (kept server-side); prompt audio is generated
// on demand by /api/det/audio. All sentences are original to AlmiDET.
//
// Run: npm run seed:listen  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PROMPT = "Listen to the sentence and type exactly what you hear.";

function item(
  title: string,
  difficulty: "FOUNDATION" | "CORE" | "STRETCH",
  sentence: string,
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "LISTEN_AND_TYPE",
    title,
    prompt: PROMPT,
    difficulty,
    topicTag: "everyday",
    payload: { sentence },
    guidanceNote: "Catch every word; small typos and missing punctuation are forgiven.",
  };
}

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  item("Short sentence — A1", "FOUNDATION", "The cat is sleeping on the bed."),
  item("Short sentence — A2", "FOUNDATION", "I would like a cup of tea, please."),
  item("Short sentence — A3", "FOUNDATION", "She walks to school every morning."),
  item("Everyday sentence — B1", "CORE", "The train was delayed because of the heavy rain."),
  item("Everyday sentence — B2", "CORE", "He decided to call his friend before dinner."),
  item("Everyday sentence — B3", "CORE", "We are planning to visit the museum on Saturday."),
  item("Longer sentence — C1", "STRETCH", "Although the meeting ran late, everyone agreed on the final decision."),
  item("Longer sentence — C2", "STRETCH", "The scientist explained that the results were both surprising and significant."),
  item("Longer sentence — C3", "STRETCH", "Despite the difficult conditions, the team managed to finish the project on time."),
];

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "LISTEN_AND_TYPE" } });
  if (existing > 0) {
    console.log(`Already ${existing} Listen and Type items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Listen and Type items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
