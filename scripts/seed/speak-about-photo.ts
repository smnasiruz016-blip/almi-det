// Seeds original "Speak About the Photo" items. Real stock photos (Unsplash,
// free license) via plain <img> in the composer; imageAlt describes the same
// scene the AI rates the transcript against. All prompts original to AlmiDET.
//
// Run: npm run seed:speak  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

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

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
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
  item(
    "The cup of coffee",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1595434091143-b375ced5fe5c?w=1000&q=80&auto=format&fit=crop",
    "A white ceramic cup of coffee sitting on a wooden table.",
  ),
  item(
    "The sleeping cat",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1630910627747-299d3bc50b4d?w=1000&q=80&auto=format&fit=crop",
    "A brown tabby cat lying asleep on a grey sofa.",
  ),
  item(
    "The beach",
    "FOUNDATION",
    "travel",
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1000&q=80&auto=format&fit=crop",
    "Waves rolling onto a sandy beach beside the open sea.",
  ),
  item(
    "The child and toys",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1532330393533-443990a51d10?w=1000&q=80&auto=format&fit=crop",
    "A child playing with colourful toy cars on a wooden table.",
  ),
  item(
    "The flower garden",
    "FOUNDATION",
    "everyday",
    "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1000&q=80&auto=format&fit=crop",
    "Bright orange flowers in bloom in a garden.",
  ),
  item(
    "The cafe table",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1764173038859-11b5bcf26d0f?w=1000&q=80&auto=format&fit=crop",
    "Two people sitting and talking at a cafe table beside large windows.",
  ),
  item(
    "The supermarket aisle",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1601600576337-c1d8a0d1373c?w=1000&q=80&auto=format&fit=crop",
    "Shelves stocked with products along a supermarket aisle.",
  ),
  item(
    "The playground",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=1000&q=80&auto=format&fit=crop",
    "A wooden playground with climbing equipment surrounded by trees.",
  ),
  item(
    "The library",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1749671232817-1f224147f0c9?w=1000&q=80&auto=format&fit=crop",
    "A large library reading room lined with bookshelves and study tables.",
  ),
  item(
    "The street musician",
    "CORE",
    "everyday",
    "https://images.unsplash.com/photo-1706990462661-558838502fc3?w=1000&q=80&auto=format&fit=crop",
    "A man playing a guitar on the street in front of a building.",
  ),
  item(
    "The harbour",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1609021933073-7f58bfce4ba4?w=1000&q=80&auto=format&fit=crop",
    "A boat docked at a harbour on the calm water.",
  ),
  item(
    "The factory floor",
    "STRETCH",
    "work",
    "https://images.unsplash.com/photo-1716643863806-989dd76ae093?w=1000&q=80&auto=format&fit=crop",
    "A factory floor filled with industrial machines and equipment.",
  ),
  item(
    "The mountain trail",
    "STRETCH",
    "travel",
    "https://images.unsplash.com/photo-1643386165206-d1be6dcc76c2?w=1000&q=80&auto=format&fit=crop",
    "A person climbing wooden steps on a trail through a wooded hillside.",
  ),
  item(
    "The wedding celebration",
    "STRETCH",
    "everyday",
    "https://images.unsplash.com/photo-1583939411023-14783179e581?w=1000&q=80&auto=format&fit=crop",
    "People dressed in white dancing and celebrating outdoors on the grass.",
  ),
  item(
    "The football match",
    "STRETCH",
    "everyday",
    "https://images.unsplash.com/photo-1434648957308-5e6a859697e8?w=1000&q=80&auto=format&fit=crop",
    "A crowd of spectators watching a football match in a stadium.",
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

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
