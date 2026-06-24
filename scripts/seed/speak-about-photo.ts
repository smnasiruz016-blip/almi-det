// Seeds original "Speak About the Photo" items. The scene is described in
// imageAlt (the AI rates the transcript against this); imageUrl is empty so the
// composer shows a captioned scene placeholder — production swaps in licensed
// photos. All scenes are original to AlmiDET.
//
// Run: npm run seed:speak  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PROMPT = "Speak about the scene for up to 90 seconds. Say what you see and what is happening.";
const GUIDANCE =
  "Cover who or what is in the scene, what is happening, and a couple of details. Keep talking in full sentences.";

function item(
  title: string,
  difficulty: "FOUNDATION" | "CORE" | "STRETCH",
  imageAlt: string,
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "SPEAK_ABOUT_THE_PHOTO",
    title,
    prompt: PROMPT,
    difficulty,
    topicTag: "everyday",
    payload: { imageUrl: "", imageAlt, prepSeconds: 20, speakSeconds: 90 },
    guidanceNote: GUIDANCE,
  };
}

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  item(
    "The park picnic",
    "FOUNDATION",
    "A family having a picnic in a park: two adults and two children sitting on a blanket with food, a ball nearby, and trees in the background.",
  ),
  item(
    "The coffee shop",
    "CORE",
    "A busy coffee shop: customers waiting at the counter, a barista making a drink, people working on laptops at small tables, and a chalkboard menu on the wall.",
  ),
  item(
    "The construction site",
    "STRETCH",
    "A construction site in a city: workers in hard hats and high-visibility vests, a crane lifting materials, scaffolding around a half-built tower, and traffic passing in the foreground.",
  ),
];

async function main() {
  const existing = await prisma.detItem.count({ where: { taskType: "SPEAK_ABOUT_THE_PHOTO" } });
  if (existing > 0) {
    console.log(`Already ${existing} Speak About the Photo items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Speak About the Photo items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
