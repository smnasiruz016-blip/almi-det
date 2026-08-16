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
  // ---- FOUNDATION — concrete everyday vocabulary ----
  item("Early on a Saturday — A1", "FOUNDATION", [
    "Every Saturday my",
    { prefix: "fam", missing: "ily" },
    "walks down our",
    { prefix: "stre", missing: "et" },
    "to the open-air",
    { prefix: "mark", missing: "et", suffix: "." },
    "We leave early, before the",
    { prefix: "morn", missing: "ing" },
    "crowds arrive, so that we can look at all the",
    { prefix: "diff", missing: "erent" },
    "stalls",
    { prefix: "toge", missing: "ther", suffix: "." },
  ]),
  item("Where to find things out — A2", "FOUNDATION", [
    "The",
    { prefix: "lib", missing: "rary" },
    "at our",
    { prefix: "sch", missing: "ool" },
    "stays open until five. Any",
    { prefix: "stud", missing: "ent" },
    "may go there to read quietly, and if you bring a",
    { prefix: "ques", missing: "tion" },
    "the librarian will help you find the",
    { prefix: "ans", missing: "wer", suffix: "." },
    "She says that knowing where to look is more",
    { prefix: "impo", missing: "rtant" },
    "than knowing everything.",
  ]),
  item("Behind the house — A3", "FOUNDATION", [
    "In",
    { prefix: "spri", missing: "ng" },
    "the small",
    { prefix: "gard", missing: "en" },
    "behind the house begins to change. The",
    { prefix: "wea", missing: "ther" },
    "turns warmer, the first",
    { prefix: "yel", missing: "low" },
    "blossoms open, and by",
    { prefix: "sum", missing: "mer" },
    "there is very",
    { prefix: "lit", missing: "tle" },
    "bare soil left.",
  ]),
  item("A week in the north — A4", "FOUNDATION", [
    "Last year we spent our",
    { prefix: "holi", missing: "day" },
    "on a small",
    { prefix: "isl", missing: "and" },
    "in the north. We took a train as far as the last",
    { prefix: "stat", missing: "ion", suffix: "," },
    "then a boat across the water. From the top of the",
    { prefix: "moun", missing: "tain" },
    "the view was so",
    { prefix: "beau", missing: "tiful" },
    "that my father took a",
    { prefix: "pict", missing: "ure" },
    "of every single bay.",
  ]),
  item("Evening at home — A5", "FOUNDATION", [
    "In the evening the",
    { prefix: "kit", missing: "chen" },
    "is the warmest room in the house. My",
    { prefix: "mot", missing: "her" },
    "opens the",
    { prefix: "wind", missing: "ow" },
    "a little, the",
    { prefix: "chil", missing: "dren" },
    "come in from the garden, and everyone agrees that food tastes",
    { prefix: "bet", missing: "ter" },
    "when it is shared. We",
    { prefix: "alw", missing: "ays" },
    "eat at the same table.",
  ]),
  item("The new bus route — A6", "FOUNDATION", [
    "A bus now runs from our",
    { prefix: "vil", missing: "lage" },
    "into town every hour. Many",
    { prefix: "peo", missing: "ple" },
    "who could not travel",
    { prefix: "bef", missing: "ore" },
    "use it to reach the",
    { prefix: "hosp", missing: "ital" },
    "or the shops, and the",
    { prefix: "num", missing: "ber" },
    "of cars on the road has fallen. In",
    { prefix: "wint", missing: "er", suffix: "," },
    "when the lanes are icy, the service matters even more.",
  ]),

  // ---- CORE — general and academic vocabulary ----
  item("The mill by the water — B1", "CORE", [
    "The mill by the river stood empty for years before the",
    { prefix: "resto", missing: "ration" },
    "began. A local",
    { prefix: "engi", missing: "neer" },
    "examined the walls and found that the",
    { prefix: "concr", missing: "ete" },
    "added in the 1960s was doing more harm than the",
    { prefix: "anc", missing: "ient" },
    "brickwork beneath it. Each weekend a",
    { prefix: "volu", missing: "nteer" },
    "team chipped it away by hand, until the building looked",
    { prefix: "fami", missing: "liar" },
    "again to the people who had grown up beside it.",
  ]),
  item("How soil holds water — B2", "CORE", [
    "Soil does not hold water evenly. Near the",
    { prefix: "surf", missing: "ace" },
    "it dries within hours whenever the",
    { prefix: "tempe", missing: "rature" },
    "rises, while the deeper",
    { prefix: "lay", missing: "ers" },
    "keep their",
    { prefix: "mois", missing: "ture" },
    "for weeks. Growers who",
    { prefix: "mea", missing: "sure" },
    "this properly can plan their planting around the local",
    { prefix: "cli", missing: "mate" },
    "instead of guessing.",
  ]),
  item("Where towns began — B3", "CORE", [
    "Long before modern roads,",
    { prefix: "trad", missing: "ing" },
    "families followed the river",
    { prefix: "rou", missing: "tes" },
    "between the coast and the hills. A",
    { prefix: "merc", missing: "hant" },
    "might travel for a whole season, exchanging salt and",
    { prefix: "pott", missing: "ery" },
    "for grain from the autumn",
    { prefix: "harv", missing: "est", suffix: "." },
    "Where two of those paths crossed, a permanent",
    { prefix: "settl", missing: "ement" },
    "usually grew.",
  ]),
  item("First week of rehearsals — B4", "CORE", [
    "Anyone who joins the school",
    { prefix: "orch", missing: "estra" },
    "chooses an",
    { prefix: "instr", missing: "ument" },
    "in the first week. The teacher gives a short",
    { prefix: "les", missing: "son" },
    "every Thursday",
    { prefix: "afte", missing: "rnoon", suffix: "," },
    "and",
    { prefix: "cons", missing: "tant" },
    "repetition at home matters far more than talent. Most players",
    { prefix: "disco", missing: "ver" },
    "that the hardest part is listening to everyone else.",
  ]),
  item("After the wet winters — B5", "CORE", [
    "Two wet winters gave the council all the",
    { prefix: "evid", missing: "ence" },
    "it needed: the old",
    { prefix: "drai", missing: "nage" },
    "system could no longer cope. Water stood in the roads,",
    { prefix: "traf", missing: "fic" },
    "slowed to a crawl, and shopkeepers reported a sharp",
    { prefix: "decl", missing: "ine" },
    "in customers. New ponds at the edge of town now",
    { prefix: "redu", missing: "ce" },
    "the flow, and a raised walkway gives people some",
    { prefix: "shel", missing: "ter" },
    "from the worst of it.",
  ]),
  item("When lessons moved online — B6", "CORE", [
    "When lessons moved online, schools had to rethink the whole",
    { prefix: "curri", missing: "culum" },
    "rather than simply move it. The strongest",
    { prefix: "argu", missing: "ment" },
    "for change was that a class which works in a room loses its",
    { prefix: "stru", missing: "cture" },
    "once a",
    { prefix: "teac", missing: "her" },
    "and a group are separated by",
    { prefix: "dist", missing: "ance", suffix: "." },
    "Many schools now keep one day at the",
    { prefix: "wee", missing: "kend" },
    "for the practical work a screen cannot carry.",
  ]),

  // ---- STRETCH — academic argument, resolved by contrast or concession ----
  item("What survives review — C1", "STRETCH", [
    "A single striking result is rarely as",
    { prefix: "compe", missing: "lling" },
    "as it first appears. Findings that survive independent",
    { prefix: "scru", missing: "tiny" },
    "usually shrink; those that do not are quietly withdrawn, though the headline they produced stays",
    { prefix: "prev", missing: "alent" },
    "online for years.",
    { prefix: "Never", missing: "theless", suffix: "," },
    "coverage still treats a",
    { prefix: "provi", missing: "sional" },
    "figure as settled, and a genuine",
    { prefix: "conse", missing: "nsus" },
    "as merely one more opinion.",
  ]),
  item("Wider roads, slower traffic — C2", "STRETCH", [
    "Widening a road to cure congestion is",
    { prefix: "counterin", missing: "tuitive" },
    "in its effect: extra capacity attracts extra journeys, and within a few years the delay returns.",
    { prefix: "Conve", missing: "rsely", suffix: "," },
    "cities that narrowed their central streets found the disruption far less",
    { prefix: "inevi", missing: "table" },
    "than predicted, because trips simply reorganised. The gain was not",
    { prefix: "tang", missing: "ible" },
    "at first, yet the",
    { prefix: "disproport", missing: "ionate" },
    "share of space given to parked cars fell sharply, and the network proved more",
    { prefix: "resil", missing: "ient" },
    "whenever one route closed.",
  ]),
  item("Reefs under pressure — C3", "STRETCH", [
    "Coral reefs are at once",
    { prefix: "abun", missing: "dant" },
    "and",
    { prefix: "frag", missing: "ile", suffix: ":" },
    "they shelter a quarter of marine species while covering a fraction of the sea floor.",
    { prefix: "Notwith", missing: "standing" },
    "decades of warning, most governments",
    { prefix: "restr", missing: "ict" },
    "fishing only after a collapse rather than before one. Reefs weakened by heat are markedly more",
    { prefix: "susce", missing: "ptible" },
    "to disease, and recovery is",
    { prefix: "argu", missing: "ably" },
    "slower than any protection plan assumes.",
  ]),
  item("Screens in the classroom — C4", "STRETCH", [
    "Classroom technology is",
    { prefix: "osten", missing: "sibly" },
    "introduced to raise attainment, yet the evidence for that",
    { prefix: "hypot", missing: "hesis" },
    "is thin. The most",
    { prefix: "rigo", missing: "rous" },
    "trials report",
    { prefix: "marg", missing: "inal" },
    "gains that vanish once teacher training is accounted for. Enthusiasts",
    { prefix: "presu", missing: "ppose" },
    "that access alone changes practice; a more",
    { prefix: "prag", missing: "matic" },
    "reading is that it changes practice only where teaching was already strong.",
  ]),
  item("The archivist's caution — C5", "STRETCH", [
    "Archivists are",
    { prefix: "meti", missing: "culous" },
    "about provenance, because a document that cannot be placed is",
    { prefix: "inhe", missing: "rently" },
    "suspect.",
    { prefix: "Parad", missing: "oxically", suffix: "," },
    "the records most useful to historians are often the most",
    { prefix: "ephe", missing: "meral" },
    "— receipts, timetables, scribbled notes — precisely because nobody thought them worth keeping. One",
    { prefix: "ano", missing: "maly" },
    "in a ledger can overturn a settled account, provided a second source can",
    { prefix: "corro", missing: "borate" },
    "it.",
  ]),
  item("Size is not importance — C6", "STRETCH", [
    "Commentators routinely",
    { prefix: "conf", missing: "late" },
    "the size of an industry with its importance. A sector may employ a",
    { prefix: "subst", missing: "antial" },
    "workforce and still make a",
    { prefix: "negl", missing: "igible" },
    "contribution to exports, while a small one can",
    { prefix: "under", missing: "pin" },
    "half a supply chain. Economists stay",
    { prefix: "scep", missing: "tical" },
    "of headline figures for that reason: almost every claim is",
    { prefix: "conti", missing: "ngent" },
    "on which measure was chosen.",
  ]),
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
