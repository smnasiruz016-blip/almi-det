// Seeds original "Write About the Photo" items. The scene is described in
// imageAlt (the AI rates against this), and imageUrl is left empty so the
// composer shows a captioned scene placeholder — production swaps in licensed
// photos. All scenes are original to AlmiDET — never copied from Duolingo.
//
// Run: npm run seed:write-photo  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PROMPT =
  "Describe the photo in at least 50 words. Say what you see and what is happening.";
const GUIDANCE =
  "Cover who or what is in the scene, what is happening, and a couple of details. Use full sentences and varied vocabulary.";

const ITEMS: Prisma.DetItemCreateManyInput[] = [
  {
    taskType: "WRITE_ABOUT_THE_PHOTO",
    title: "The morning market",
    prompt: PROMPT,
    difficulty: "CORE",
    topicTag: "everyday",
    payload: {
      imageUrl: "",
      imageAlt:
        "A busy outdoor farmers' market in the morning: wooden stalls piled with fruit and vegetables, a vendor handing a paper bag to a customer, and people walking between the stalls carrying baskets.",
      minWords: 50,
    },
    guidanceNote: GUIDANCE,
  },
  {
    taskType: "WRITE_ABOUT_THE_PHOTO",
    title: "The study desk",
    prompt: PROMPT,
    difficulty: "CORE",
    topicTag: "everyday",
    payload: {
      imageUrl: "",
      imageAlt:
        "A quiet home study desk by a window: an open laptop, a stack of books, a mug of tea, and a small potted plant, with afternoon light coming through the blinds.",
      minWords: 50,
    },
    guidanceNote: GUIDANCE,
  },
  {
    taskType: "WRITE_ABOUT_THE_PHOTO",
    title: "The train platform",
    prompt: PROMPT,
    difficulty: "STRETCH",
    topicTag: "travel",
    payload: {
      imageUrl: "",
      imageAlt:
        "A train platform at rush hour: commuters in coats waiting behind the yellow line, a train arriving with its doors still closed, a large clock on the wall, and a person checking their phone.",
      minWords: 50,
    },
    guidanceNote: GUIDANCE,
  },
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
