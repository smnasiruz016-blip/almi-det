// Seeds original "Fill in the Blanks" items — sentence-scope cloze, ONE gap.
//
// EMPTY ON PURPOSE — the sentences are authored separately. Registered with
// `live: false` in src/lib/det/registry.ts until they land.
//
// HOW THIS DIFFERS FROM READ AND COMPLETE, AND WHY IT IS HARDER TO AUTHOR
//
// Read and Complete gives a paragraph: a gap that is loose on its own is often
// pinned down by the sentence before it. Here there is ONE sentence and nothing
// else. Whatever constrains the answer has to be inside it.
//
// Measured against a 275k word list, a prefix plus a letter count typically
// fits dozens of real words ("comp" + 4 fits 49). With a passage, context does
// the narrowing. With a single sentence, the sentence must do it alone — so
// reveal more prefix, and write sentences that genuinely force one word.
//
// AUTHORING CONTRACT — enforced by `npm run gate:cloze`:
//   · EXACTLY ONE blank per item.
//   · A single self-contained sentence — no second sentence, no passage.
//   · visiblePrefix + missingLetters must be a real English word.
//   · missingLetters is LETTERS ONLY.
//   · The completed word must not appear elsewhere in the sentence, nor in the
//     item's title / prompt / guidanceNote.
//   · Difficulty is WORD RARITY: median frequency rank of blanked words rises
//     FOUNDATION -> CORE -> STRETCH.
//   · Ambiguity is BLOCKING for this type, not advisory. A gap whose form fits
//     many words and carries no keyed alternative is a gap a single sentence
//     probably cannot resolve.
//
// Run: npm run seed:fill-blanks  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

const prisma = new PrismaClient();

type Level = "FOUNDATION" | "CORE" | "STRETCH";

export type Blank = {
  prefix: string;
  missing: string;
  alsoAccept?: string[];
  suffix?: string;
};

/** Authoring shorthand: strings are literal text, the object is THE blank. */
export type Piece = string | Blank;

export function sentence(pieces: Piece[]): Prisma.InputJsonValue {
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
  FOUNDATION: "Complete the word. The rest of the sentence tells you which word it is.",
  CORE: "One word is missing its ending. Use the sentence to work out which word belongs.",
  STRETCH: "Restore the missing letters. Only one word fits both the letters shown and the sense of the sentence.",
};

const GUIDANCE: Record<Level, string> = {
  FOUNDATION: "Read to the end before you answer — the last few words often decide it.",
  CORE: "Several words may start the same way. Let the meaning of the sentence choose between them.",
  STRETCH: "Watch the grammar around the gap: what follows it usually rules out most of the candidates.",
};

const TOPIC: Record<Level, string> = {
  FOUNDATION: "everyday-sentence",
  CORE: "general-sentence",
  STRETCH: "academic-sentence",
};

export function item(title: string, difficulty: Level, pieces: Piece[]): Prisma.DetItemCreateManyInput {
  return {
    taskType: "FILL_IN_THE_BLANKS",
    title,
    prompt: PROMPT[difficulty],
    difficulty,
    topicTag: TOPIC[difficulty],
    payload: sentence(pieces),
    guidanceNote: GUIDANCE[difficulty],
  };
}

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
  // Authored sentences go here — see the contract above.
];

async function main() {
  if (ITEMS.length === 0) {
    console.log("No Fill in the Blanks sentences authored yet — nothing to seed.");
    return;
  }
  const existing = await prisma.detItem.count({ where: { taskType: "FILL_IN_THE_BLANKS" } });
  if (existing > 0) {
    console.log(`Already ${existing} Fill in the Blanks items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Fill in the Blanks items.`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
