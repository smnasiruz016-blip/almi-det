// Seeds original "Write About the Photo" items. Real stock photos (Unsplash,
// free license) via plain <img> in the composer; imageAlt describes the same
// scene the AI rates against, so the human and the rater stay consistent.
//
// Run: npm run seed:write-photo  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PROMPT = "Describe the photo in at least 50 words. Say what you see and what is happening.";
const GUIDANCE =
  "Cover who or what is in the scene, what is happening, and a couple of details. Use full sentences and varied vocabulary.";

function item(
  title: string,
  difficulty: "FOUNDATION" | "CORE" | "STRETCH",
  topicTag: string,
  imageUrl: string,
  imageAlt: string,
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "WRITE_ABOUT_THE_PHOTO",
    title,
    prompt: PROMPT,
    difficulty,
    topicTag,
    payload: { imageUrl, imageAlt, minWords: 50 },
    guidanceNote: GUIDANCE,
  };
}

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  item(
    "The morning market",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1526399743290-f73cb4022f48?w=1000&q=80&auto=format&fit=crop",
    "An outdoor market with stalls of fresh fruit and vegetables and people shopping among them.",
  ),
  item(
    "The study desk",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=1000&q=80&auto=format&fit=crop",
    "A desk by a window with a laptop, some books and a few personal items, lit by daylight.",
  ),
  item(
    "The train platform",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1527295110-5145f6b148d0?w=1000&q=80&auto=format&fit=crop",
    "A train station platform with a train alongside it and people waiting near the edge.",
  ),
];

async function main() {
  const existing = await prisma.detItem.count({
    where: { taskType: "WRITE_ABOUT_THE_PHOTO" },
  });
  if (existing > 0) {
    console.log(`Already ${existing} Write About the Photo items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Write About the Photo items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
