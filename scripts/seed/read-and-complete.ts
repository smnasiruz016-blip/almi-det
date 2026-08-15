// Seeds original "Read and Complete" (cloze) passages.
//
// EMPTY ON PURPOSE — the passages are authored separately. The task type is
// registered with `live: false` in src/lib/det/registry.ts until they land, so
// the practice hub shows "Coming soon" and MOCK_ORDER (derived from `live`)
// skips it. Flip `live` to true in the same change that fills ITEMS.
//
// AUTHORING CONTRACT — enforced by `npm run gate:cloze`, not by convention:
//   · >= 5 blanks per passage, target 6-8, denser at higher difficulty.
//   · visiblePrefix + missingLetters must be a real English word.
//   · missingLetters is LETTERS ONLY (it is typed on a plain keyboard).
//   · A blanked word must not appear un-blanked elsewhere in the same passage,
//     nor in the item's title / prompt / guidanceNote.
//   · Every blank needs context: real words before or after it in the passage.
//   · alsoAccept carries any completion that fits BOTH the letters AND the
//     sentence — marking valid, context-fitting English wrong would be unfair.
//   · Difficulty is WORD RARITY, not passage length: the median frequency rank
//     of blanked words must rise FOUNDATION -> CORE -> STRETCH.
//
// Run: npm run seed:read-complete  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

const prisma = new PrismaClient();

type Level = "FOUNDATION" | "CORE" | "STRETCH";

/** A blank: the letters shown, the letters keyed, and any fair alternatives. */
export type Blank = {
  prefix: string;
  missing: string;
  alsoAccept?: string[];
  suffix?: string;
};

/** Passage authoring shorthand: plain strings are literal text, objects are
 *  blanks. Token ids (b1..bN) are generated positionally, like w1..wN. */
export type Piece = string | Blank;

export function passage(pieces: Piece[]): Prisma.InputJsonValue {
  let n = 0;
  return {
    passage: pieces.map((p) =>
      typeof p === "string"
        ? { kind: "text", text: p }
        : {
            kind: "blank",
            id: `b${++n}`,
            visiblePrefix: p.prefix,
            missingLetters: p.missing,
            ...(p.alsoAccept?.length ? { alsoAccept: p.alsoAccept } : {}),
            ...(p.suffix ? { suffix: p.suffix } : {}),
          },
    ),
  } as unknown as Prisma.InputJsonValue;
}

const PROMPT: Record<Level, string> = {
  FOUNDATION: "Some letters are missing. Use the sentence to work out each word, then type the missing letters.",
  CORE: "Complete each word using the rest of the passage as your guide. Type only the missing letters.",
  STRETCH: "Restore the missing letters. The surrounding argument, not the word shape alone, tells you which word belongs.",
};

const GUIDANCE: Record<Level, string> = {
  FOUNDATION: "Read the whole sentence first. The words around a gap usually make only one word possible.",
  CORE: "If several words start the same way, let the sentence decide which one fits.",
  STRETCH: "Read for the direction of the argument; a gap often turns on whether the sentence agrees or contrasts.",
};

const TOPIC: Record<Level, string> = {
  FOUNDATION: "everyday-passage",
  CORE: "general-passage",
  STRETCH: "academic-passage",
};

export function item(
  title: string,
  difficulty: Level,
  pieces: Piece[],
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "READ_AND_COMPLETE",
    title,
    prompt: PROMPT[difficulty],
    difficulty,
    topicTag: TOPIC[difficulty],
    payload: passage(pieces),
    guidanceNote: GUIDANCE[difficulty],
  };
}

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
  // Authored passages go here — see the contract above.
];

async function main() {
  if (ITEMS.length === 0) {
    console.log("No Read and Complete passages authored yet — nothing to seed.");
    return;
  }
  const existing = await prisma.detItem.count({ where: { taskType: "READ_AND_COMPLETE" } });
  if (existing > 0) {
    console.log(`Already ${existing} Read and Complete items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Read and Complete items.`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
