// Seeds original "Speak About the Photo" items. Real stock photos (Unsplash,
// free license) via plain <img> in the composer; imageAlt describes the same
// scene the AI rates the transcript against. All prompts original to AlmiDET.
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
  topicTag: string,
  imageUrl: string,
  imageAlt: string,
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "SPEAK_ABOUT_THE_PHOTO",
    title,
    prompt: PROMPT,
    difficulty,
    topicTag,
    payload: { imageUrl, imageAlt, prepSeconds: 20, speakSeconds: 90 },
    guidanceNote: GUIDANCE,
  };
}

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  item(
    "The park picnic",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1585938389612-a552a28d6914?w=1000&q=80&auto=format&fit=crop",
    "People having a picnic outdoors in a park, with food on a blanket and trees around.",
  ),
  item(
    "The coffee shop",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1000&q=80&auto=format&fit=crop",
    "The inside of a coffee shop with a counter, seating and customers.",
  ),
  item(
    "The construction site",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1000&q=80&auto=format&fit=crop",
    "A construction site with workers, machinery and a partly-built structure.",
  ),
];

async function main() {
  const existing = await prisma.detItem.count({
    where: { taskType: "SPEAK_ABOUT_THE_PHOTO" },
  });
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
