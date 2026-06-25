// Seeds original "Write About the Photo" items. Real stock photos (Unsplash,
// free license) via plain <img> in the composer; imageAlt describes the same
// scene the AI rates against, so the human and the rater stay consistent.
//
// Run: npm run seed:write-photo  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

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

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
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
  item(
    "The modern kitchen",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1000&q=80&auto=format&fit=crop",
    "A modern kitchen with white cupboards, a marble island counter and appliances.",
  ),
  item(
    "The child reading",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1553729784-e91953dec042?w=1000&q=80&auto=format&fit=crop",
    "A young girl sitting and reading an open book.",
  ),
  item(
    "The dog in the park",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1628105122995-972f14d650f9?w=1000&q=80&auto=format&fit=crop",
    "A brown and white dog running across a grassy field in a park.",
  ),
  item(
    "The breakfast table",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1578704311587-4fbd590630d5?w=1000&q=80&auto=format&fit=crop",
    "A table set with a breakfast spread of cooked food, bread and sliced fruit.",
  ),
  item(
    "The parked bicycle",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1505705694340-019e1e335916?w=1000&q=80&auto=format&fit=crop",
    "A bicycle leaning against a painted wall on a sunny day.",
  ),
  item(
    "The family in the kitchen",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1761839258568-fd466a93f68b?w=1000&q=80&auto=format&fit=crop",
    "A family cooking together in a bright kitchen, preparing food at the counter.",
  ),
  item(
    "The classroom",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1000&q=80&auto=format&fit=crop",
    "Students sitting in a classroom while a teacher presents at the front.",
  ),
  item(
    "The market stall",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1645976442233-bcf005876613?w=1000&q=80&auto=format&fit=crop",
    "A group of people gathered around a fruit and vegetable stall at an outdoor market.",
  ),
  item(
    "The bus stop",
    "CORE",
    "travel",
    "https://images.unsplash.com/photo-1696545720052-b2c622c058b5?w=1000&q=80&auto=format&fit=crop",
    "A group of people standing and waiting at a bus stop beside the road.",
  ),
  item(
    "The restaurant kitchen",
    "CORE",
    "work",
    "https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=1000&q=80&auto=format&fit=crop",
    "A chef in a white uniform cooking over a stove in a busy restaurant kitchen.",
  ),
  item(
    "The station concourse",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1662251655454-cd72bd7fe6ed?w=1000&q=80&auto=format&fit=crop",
    "A large crowd of people inside the busy concourse of a railway station.",
  ),
  item(
    "The night market",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1535898331935-2d274aff0fbc?w=1000&q=80&auto=format&fit=crop",
    "People eating and browsing food stalls at a busy street market in the evening.",
  ),
  item(
    "The construction site",
    "STRETCH",
    "work",
    "https://images.unsplash.com/photo-1644221150186-5d785a471f44?w=1000&q=80&auto=format&fit=crop",
    "A large building under construction beside a tall crane, with scaffolding around it.",
  ),
  item(
    "The airport terminal",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1687992176093-6417a93fa3d0?w=1000&q=80&auto=format&fit=crop",
    "Passengers walking with luggage through a large airport terminal.",
  ),
  item(
    "The busy street",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1592489427434-fd9696f768b0?w=1000&q=80&auto=format&fit=crop",
    "A crowded city street with many people walking during the day.",
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

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
