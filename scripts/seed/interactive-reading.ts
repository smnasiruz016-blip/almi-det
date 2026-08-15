// Seeds original "Interactive Reading" sets — one passage plus ~6 selection
// questions across five sub-kinds.
//
// EMPTY ON PURPOSE — the sets are authored separately. The task type is
// registered with `live: false` in src/lib/det/registry.ts until they land, so
// the practice hub shows "Coming soon" and MOCK_ORDER (derived from `live`)
// skips it. Flip `live` to true in the same change that fills ITEMS.
//
// AUTHORING CONTRACT — enforced by `npm run gate:reading-set`:
//   · ~6 questions per set; every sub-kind used somewhere in the bank.
//   · The passage is written as SENTENCES. Every sentence becomes a selectable
//     span, whether or not a question targets it — that uniformity is what stops
//     the markup from revealing the Highlight answer.
//   · >= 3 options per select question; exactly one correct; options distinct.
//   · The correct option must NOT be the longest option in most questions, and
//     the correct position must not concentrate — both are answerable without
//     reading.
//   · The correct option must not share distinctive words with the stem that the
//     distractors lack.
//   · Difficulty is passage VOCABULARY RARITY, not passage length.
//
// Run: npm run seed:interactive-reading  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";

const prisma = new PrismaClient();

type Level = "FOUNDATION" | "CORE" | "STRETCH";

/** Authoring shorthand. `correct` names the option TEXT, so an author never
 *  hand-writes ids and the key cannot drift out of sync with the options. */
export type Select = {
  kind: "COMPLETE_THE_SENTENCES" | "COMPLETE_THE_PASSAGE" | "IDENTIFY_THE_IDEA" | "TITLE_THE_PASSAGE";
  stem: string;
  options: string[];
  correct: string;
};

/** `correctSentence` names the passage SENTENCE (1-based) that answers it. */
export type Highlight = {
  kind: "HIGHLIGHT_THE_ANSWER";
  stem: string;
  correctSentence: number;
};

export type Question = Select | Highlight;

export function build(sentences: string[], questions: Question[]): Prisma.InputJsonValue {
  const spans = sentences.map((text, i) => ({ id: `s${i + 1}`, text }));
  let n = 0;
  const qs = questions.map((q) => {
    const id = `q${++n}`;
    if (q.kind === "HIGHLIGHT_THE_ANSWER") {
      const span = spans[q.correctSentence - 1];
      if (!span) throw new Error(`${id}: correctSentence ${q.correctSentence} is out of range`);
      return { kind: q.kind, id, stem: q.stem, correctSpanId: span.id };
    }
    const options = q.options.map((text, i) => ({ id: `${id}o${i + 1}`, text }));
    const correct = options.find((o) => o.text === q.correct);
    if (!correct) throw new Error(`${id}: correct "${q.correct}" is not one of the options`);
    return { kind: q.kind, id, stem: q.stem, options, correctId: correct.id };
  });
  return { passage: { spans }, questions: qs } as unknown as Prisma.InputJsonValue;
}

const PROMPT: Record<Level, string> = {
  FOUNDATION: "Read the passage, then answer the questions about it.",
  CORE: "Read the passage carefully. Each question below refers to it.",
  STRETCH: "Read the passage, then answer the questions. Some ask what the writer means rather than what the writer says.",
};

const GUIDANCE: Record<Level, string> = {
  FOUNDATION: "Look back at the passage for every question. The answer is always there.",
  CORE: "When two choices both look possible, find the sentence that decides between them.",
  STRETCH: "Distinguish what is stated from what is implied; the best title covers the whole passage, not one paragraph.",
};

const TOPIC: Record<Level, string> = {
  FOUNDATION: "everyday-reading-set",
  CORE: "general-reading-set",
  STRETCH: "academic-reading-set",
};

export function item(
  title: string,
  difficulty: Level,
  sentences: string[],
  questions: Question[],
): Prisma.DetItemCreateManyInput {
  return {
    taskType: "INTERACTIVE_READING",
    title,
    prompt: PROMPT[difficulty],
    difficulty,
    topicTag: TOPIC[difficulty],
    payload: build(sentences, questions),
    guidanceNote: GUIDANCE[difficulty],
  };
}

export const ITEMS: Prisma.DetItemCreateManyInput[] = [
  // ---- FOUNDATION — concrete everyday passages ----
  item("The corner bakery — A1", "FOUNDATION",
    [
      "The shop on the corner opens before six in the morning.",
      "Most of the bread has been sold by nine.",
      "The woman who runs it learned to bake from her mother.",
      "She still makes everything by hand, as she always has.",
      "People say you can smell it from the end of the road.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "Anyone arriving ___ nine will find very little bread left.",
        options: ["after", "since", "before", "until"], correct: "after" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "One line has been taken out of the end. Which one belongs there?",
        options: [
          "The shop closed down several years ago.",
          "Regular buyers queue long before it opens.",
          "Nobody in this town eats bread any more.",
          "The owner wants to sell the building.",
        ], correct: "Regular buyers queue long before it opens." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence tells you where she learned to bake?", correctSentence: 3 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Choose the statement that best sums up the whole text.",
        options: [
          "A mother taught her daughter how to bake bread.",
          "Bread in this town sells out earlier each year.",
          "A small bakery keeps old habits and stays busy.",
          "A road is known for the way it smells at dawn.",
        ], correct: "A small bakery keeps old habits and stays busy." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Bread sold out before nine",
          "Learning to bake from a mother",
          "A road that smells of bread",
          "The early corner bakery",
        ], correct: "The early corner bakery" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Bread that is not bought early has ___ by the afternoon.",
        options: ["gone", "warm", "fresh", "baked"], correct: "gone" },
    ]),

  item("The school garden — A2", "FOUNDATION",
    [
      "Last year the children planted a garden behind the classrooms.",
      "Each class looks after one bed of vegetables.",
      "The youngest pupils water the plants every Monday.",
      "In summer the beans grow taller than the fence.",
      "Whatever the garden gives is cooked in the school kitchen.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "Every class is ___ for one bed of vegetables.",
        options: ["willing", "responsible", "curious", "careful"], correct: "responsible" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence says how often the youngest children water the plants?", correctSentence: 3 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement covers the whole text best?",
        options: [
          "Young pupils are given the simplest jobs in a school.",
          "A school kitchen cooks meals from bought vegetables.",
          "A school grows food and the pupils share the work.",
          "Beans are the easiest vegetable for children to grow.",
        ], correct: "A school grows food and the pupils share the work." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the second one?",
        options: [
          "Most of the beds were dug up again last spring.",
          "Nothing has grown behind the classrooms since then.",
          "No class has ever agreed on what to plant.",
          "The beds are marked with a painted wooden sign.",
        ], correct: "The beds are marked with a painted wooden sign." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "The garden behind the school",
          "Cooking in a school kitchen",
          "Beans taller than a fence",
          "Monday is watering day",
        ], correct: "The garden behind the school" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "The beans climb ___ the top of the fence in summer.",
        options: ["around", "above", "along", "among"], correct: "above" },
    ]),

  item("The early bus — A3", "FOUNDATION",
    [
      "Maria has driven the first bus of the day for eleven years.",
      "She sets out while the streets are still dark and empty.",
      "Most of the people on board work at the hospital.",
      "She knows almost all of them by name, and they know hers.",
      "On cold days she waits an extra minute at every stop.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "At that hour there is very little ___ on the roads.",
        options: ["tremble", "trailer", "traffic", "trouble"], correct: "traffic" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs at the end of the text?",
        options: [
          "She has asked to be moved to a later route.",
          "Nobody has thanked her for eleven long years.",
          "Her passengers have never spoken to each other.",
          "Nobody who works those hours is left behind.",
        ], correct: "Nobody who works those hours is left behind." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence tells you where most of her passengers work?", correctSentence: 3 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Choose the statement that covers the whole text.",
        options: [
          "A driver knows her route and looks after the people on it.",
          "Hospital staff must travel earlier than most other workers.",
          "Driving a bus is harder in winter than at other times.",
          "Eleven years on one route is longer than most drivers stay.",
        ], correct: "A driver knows her route and looks after the people on it." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Eleven years behind the wheel",
          "The first bus of the day",
          "The people who ride at dawn",
          "Waiting a minute longer",
        ], correct: "The first bus of the day" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Maria has held the same job for more than ___ years.",
        options: ["thirty", "five", "ten", "twenty"], correct: "ten" },
    ]),

  item("A morning at the beach — A4", "FOUNDATION",
    [
      "The tide goes out a long way here in the early morning.",
      "Families walk on the wet sand looking for shells.",
      "Small crabs hide in the pools between the rocks.",
      "By midday the water has covered the pools again.",
      "The best time to come is just after sunrise.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The sea ___ the rock pools again by the middle of the day.",
        options: ["leaves", "washes", "reaches", "covers"], correct: "covers" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence tells you where the small crabs are found?", correctSentence: 3 },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "The beach at low tide",
          "Families by the water",
          "Crabs between the rocks",
          "Shells on the wet sand",
        ], correct: "The beach at low tide" },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement covers the whole text best?",
        options: [
          "Rock pools hold more life than the open sand does.",
          "This beach is worth visiting early, before the sea returns.",
          "Children enjoy finding shells more than watching crabs.",
          "The sea here is dangerous once the middle of the day comes.",
        ], correct: "This beach is worth visiting early, before the sea returns." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the third one?",
        options: [
          "Nobody has seen a crab on this beach for years.",
          "The rocks are too sharp for anyone to walk on.",
          "Children crouch over them without making a sound.",
          "Most families stay away until the tide is high.",
        ], correct: "Children crouch over them without making a sound." },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Arriving in the middle of the day would be a ___.",
        options: ["journey", "holiday", "pleasure", "mistake"], correct: "mistake" },
    ]),

  item("The cat that came back — A5", "FOUNDATION",
    [
      "A grey cat disappeared from Mill Street in October.",
      "Its owner put notices on every lamp post in the town.",
      "Three families phoned to say they had fed a grey cat.",
      "It was found in a warm shed two streets away.",
      "It had been sleeping there for most of the winter.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The owner wanted to ___ the whole town about the missing cat.",
        options: ["alert", "allow", "agree", "admit"], correct: "alert" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs at the end of the text?",
        options: [
          "The shed had been locked since the previous year.",
          "The families had all been feeding the same animal.",
          "Its owner decided not to keep a cat again.",
          "Nobody ever discovered where the cat had gone.",
        ], correct: "The families had all been feeding the same animal." },
      { kind: "IDENTIFY_THE_IDEA", stem: "Choose the statement that covers the whole text.",
        options: [
          "Cats often choose a warm shed to sleep through winter.",
          "Three families in one town were feeding stray animals.",
          "A lost cat was found nearby after several people helped.",
          "Notices on lamp posts are the best way to find a pet.",
        ], correct: "A lost cat was found nearby after several people helped." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence tells you where the cat was living?", correctSentence: 4 },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Three families and a cat",
          "Notices on every lamp post",
          "A winter in a warm shed",
          "The grey cat of Mill Street",
        ], correct: "The grey cat of Mill Street" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "The cat had not travelled ___ from its home.",
        options: ["far", "fast", "deep", "high"], correct: "far" },
    ]),

  item("Snow above the village — A6", "FOUNDATION",
    [
      "Snow stays on the high ground here until the end of April.",
      "The road to the next village is closed for weeks at a time.",
      "Farmers bring the sheep down to the lower fields in November.",
      "Every house keeps wood stacked against the back wall.",
      "By May the grass on the hillside is green again.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The snow on the tops does not ___ until late April.",
        options: ["dry", "melt", "fall", "rise"], correct: "melt" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence tells you what the farmers do in November?", correctSentence: 3 },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "A road closed for weeks",
          "Sheep in the lower fields",
          "A long winter up the hill",
          "Wood against the back wall",
        ], correct: "A long winter up the hill" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the second one?",
        options: [
          "The road was rebuilt entirely the previous spring.",
          "Snow has not fallen on this hillside since then.",
          "Nobody has lived in the next village for years.",
          "Families plan their shopping around the weather.",
        ], correct: "Families plan their shopping around the weather." },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement covers the whole text best?",
        options: [
          "Life in this village is arranged around a long winter.",
          "The road between the villages needs rebuilding properly.",
          "Spring arrives later here than anywhere else in the country.",
          "Sheep cannot survive on high ground once snow arrives.",
        ], correct: "Life in this village is arranged around a long winter." },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Each family builds up a ___ of fuel before the cold arrives.",
        options: ["shelter", "supply", "surface", "signal"], correct: "supply" },
    ]),

  // ---- CORE — general and academic passages ----
  item("How bees find a flower — B1", "CORE",
    [
      "A returning bee performs a movement that other workers gather round to watch.",
      "The angle of the movement indicates direction relative to the position of the sun.",
      "Its duration corresponds to the distance the forager has travelled.",
      "Observers leave the hive and search the area the movement describes.",
      "The accuracy of the information declines as the source becomes more distant.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The angle tells the other workers which ___ to take.",
        options: ["result", "record", "route", "reason"], correct: "route" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the third one?",
        options: [
          "Nobody has managed to observe a hive for long enough.",
          "The duration of the movement appears to be random.",
          "Distance seems to have no influence on the display.",
          "Longer movements therefore describe a further journey.",
        ], correct: "Longer movements therefore describe a further journey." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence explains what the length of the movement corresponds to?", correctSentence: 3 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Choose the statement that covers the whole text.",
        options: [
          "A single display carries both direction and distance, imperfectly.",
          "The position of the sun governs everything a colony does.",
          "Foragers travelling far are less useful to a colony than others.",
          "Bees returning to a hive are watched closely by other workers.",
        ], correct: "A single display carries both direction and distance, imperfectly." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Distance and the honey supply",
          "Directions given by movement",
          "The influence of sunlight",
          "Watching a returning forager",
        ], correct: "Directions given by movement" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "The information becomes less ___ as the source gets further away.",
        options: ["agreeable", "removable", "reliable", "available"], correct: "reliable" },
    ]),

  item("The harbour that silted up — B2", "CORE",
    [
      "For four centuries this harbour handled more cargo than any other on the coast.",
      "Sediment carried by the river gradually reduced the depth of the channel.",
      "Larger vessels began to unload at a rival port further south.",
      "The merchant families moved their business within a single generation.",
      "The warehouses that remain are now converted into apartments.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "Ships of the older size could no longer ___ the inner quay.",
        options: ["repair", "return", "remain", "reach"], correct: "reach" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence explains why ships began using a different port?", correctSentence: 2 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement covers the whole text best?",
        options: [
          "A physical change to the water ended a long commercial history.",
          "Rival ports further south have always been the deeper ones.",
          "Merchant families were slow to react to a falling trade.",
          "Warehouses make better apartments than they do storage.",
        ], correct: "A physical change to the water ended a long commercial history." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the fourth one?",
        options: [
          "Nothing about the town has altered since that period.",
          "What had taken centuries to build was lost in decades.",
          "The channel was dredged successfully the following year.",
          "Its rival never handled any significant volume of cargo.",
        ], correct: "What had taken centuries to build was lost in decades." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Merchants and their families",
          "Warehouses and apartments",
          "How a harbour was lost",
          "Four centuries of cargo",
        ], correct: "How a harbour was lost" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "The decline was rapid enough to happen within one ___.",
        options: ["language", "landmark", "landscape", "lifetime"], correct: "lifetime" },
    ]),

  item("What the recycling audit found — B3", "CORE",
    [
      "The council examined the contents of four hundred household bins.",
      "Almost a third of the material placed in recycling bins was contaminated.",
      "A single unwashed container can spoil an entire collection.",
      "Households that received a printed guide made fewer errors.",
      "The council now prints the guide in six languages.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "A third of what people put out was too dirty to be ___.",
        options: ["used", "sold", "kept", "moved"], correct: "used" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the third one?",
        options: [
          "The council has stopped examining household bins entirely.",
          "One careless household therefore affects all its neighbours.",
          "Washing a container makes no measurable difference at all.",
          "Collections have been abandoned in most of the district.",
        ], correct: "One careless household therefore affects all its neighbours." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence describes what the council did after seeing the results?", correctSentence: 5 },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Guides printed in six languages",
          "One container spoils a load",
          "Why the recycling failed",
          "Four hundred bins examined",
        ], correct: "Why the recycling failed" },
      { kind: "IDENTIFY_THE_IDEA", stem: "Choose the statement that covers the whole text.",
        options: [
          "Most households are unwilling to recycle their waste properly.",
          "Councils should examine household bins far more often.",
          "Printed information is wasted on most of the population.",
          "Poor sorting undermines collection, and instruction helps.",
        ], correct: "Poor sorting undermines collection, and instruction helps." },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Clear instruction produced a ___ rate of sorting mistakes.",
        options: ["lower", "wider", "later", "louder"], correct: "lower" },
    ]),

  item("Learning a difficult instrument — B4", "CORE",
    [
      "Beginners on the violin produce a harsh, uneven tone for several months.",
      "The instrument has no frets, so accurate pitch depends entirely on hand position.",
      "Instructors therefore concentrate on posture and grip before discussing musical phrasing.",
      "Brief daily repetition yields measurably faster progress than a single weekly session.",
      "The awkward stage concludes sooner than discouraged beginners generally expect.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "Getting the pitch right is entirely a matter of hand ___.",
        options: ["engagement", "placement", "agreement", "statement"], correct: "placement" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence explains why teachers begin with posture?", correctSentence: 2 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement covers the whole text best?",
        options: [
          "The violin is the most difficult instrument to begin with.",
          "Frequent short practice matters more than long weekly sessions.",
          "An awkward beginning is built into the instrument, and passes.",
          "Teachers of the violin rarely discuss music with beginners.",
        ], correct: "An awkward beginning is built into the instrument, and passes." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs at the end of the text?",
        options: [
          "The violin should be attempted only by adults.",
          "Most pupils abandon the instrument within a month.",
          "Nothing a teacher does can shorten that period.",
          "What sounds like a lack of talent is simply a stage.",
        ], correct: "What sounds like a lack of talent is simply a stage." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "The first months of the violin",
          "Posture before music",
          "Practising every single day",
          "An instrument without frets",
        ], correct: "The first months of the violin" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Short daily practice ___ better results than one long session.",
        options: ["proposes", "produces", "promises", "prevents"], correct: "produces" },
    ]),

  item("Cutting the railway through — B5", "CORE",
    [
      "The line had to cross eleven miles of unstable ground.",
      "Engineers drove timber piles deep into the peat before laying any track.",
      "Whole sections of the embankment sank twice during construction.",
      "The company nearly abandoned the route in the second winter.",
      "The finished line carried freight for the next ninety years.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The ground could not be trusted to carry the ___ of a train.",
        options: ["warmth", "wonder", "weight", "wealth"], correct: "weight" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the third one?",
        options: [
          "Peat turned out to be the ideal foundation material.",
          "Construction continued without any serious difficulty.",
          "The embankment has never required any repair since.",
          "Each collapse meant months of work done a second time.",
        ], correct: "Each collapse meant months of work done a second time." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence describes what the engineers did before laying track?", correctSentence: 2 },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Building across bad ground",
          "Ninety years of freight",
          "Timber piles in the peat",
          "The winter of the collapse",
        ], correct: "Building across bad ground" },
      { kind: "IDENTIFY_THE_IDEA", stem: "Choose the statement that covers the whole text.",
        options: [
          "The company should have chosen a different route entirely.",
          "A costly and uncertain project proved worth completing.",
          "Railway embankments sink unless timber piles are used.",
          "Peat is the most difficult material engineers encounter.",
        ], correct: "A costly and uncertain project proved worth completing." },
      { kind: "COMPLETE_THE_SENTENCES", stem: "For a time the directors considered ___ the project entirely.",
        options: ["dressing", "drafting", "dropping", "drawing"], correct: "dropping" },
    ]),

  item("The hospital at three in the morning — B6", "CORE",
    [
      "The corridors are quieter, yet clinical staffing reaches its thinnest point.",
      "Judgements taken at this hour involve fewer colleagues and reduced supervision.",
      "Audits of admission records reveal a measurable overnight rise in avoidable errors.",
      "Several trusts now roster an additional senior nurse across the quiet hours.",
      "The additional salary costs considerably less than the incidents it averts.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "Overnight the number on duty falls to its ___ level.",
        options: ["latest", "largest", "longest", "lowest"], correct: "lowest" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence reports what the records actually showed?", correctSentence: 3 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement covers the whole text best?",
        options: [
          "Night errors reflect thin staffing, and staffing can be changed.",
          "Records of hospital incidents are rarely studied carefully.",
          "Hospitals are quieter at night than at any other time.",
          "Senior nurses should always work through the small hours.",
        ], correct: "Night errors reflect thin staffing, and staffing can be changed." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs at the end of the text?",
        options: [
          "Senior nurses prefer to work during daylight hours.",
          "The quiet of a night corridor is not the same as safety.",
          "Overnight staffing has been reduced again since then.",
          "Most hospitals see no difference between night and day.",
        ], correct: "The quiet of a night corridor is not the same as safety." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "The cost of a second nurse",
          "Reading the incident records",
          "Why the night shift matters",
          "Quiet corridors after midnight",
        ], correct: "Why the night shift matters" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "The extra post costs less than the incidents it ___.",
        options: ["presents", "preserves", "pretends", "prevents"], correct: "prevents" },
    ]),

  // ---- STRETCH — academic argument; the answer turns on what is implied ----
  item("The trouble with a single result — C1", "STRETCH",
    [
      "A finding that has never been repeated is not yet knowledge, however striking it appears.",
      "Replication is unglamorous, poorly funded, and seldom published in prominent journals.",
      "The incentives of an academic career therefore reward novelty over verification.",
      "Fields that have audited themselves report that a substantial minority of results do not survive.",
      "The remedy is institutional rather than moral; researchers respond to what is rewarded.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The system rewards discovery far more than ___.",
        options: ["confirmation", "compensation", "consultation", "contribution"], correct: "confirmation" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence indicates where the writer thinks the solution lies?", correctSentence: 5 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement best expresses the writer's argument?",
        options: [
          "Prominent journals should be obliged to publish repeated studies.",
          "The problem is structural, so blaming individuals will not fix it.",
          "Most published findings in every discipline are simply mistaken.",
          "Researchers who publish unrepeatable findings are being dishonest.",
        ], correct: "The problem is structural, so blaming individuals will not fix it." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the second one?",
        options: [
          "Funding bodies treat replication as their first priority.",
          "Repeating a study is the surest route to promotion.",
          "Nobody attempting it can expect much professional credit.",
          "Journals compete to publish confirmations of earlier work.",
        ], correct: "Nobody attempting it can expect much professional credit." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Auditing an academic discipline",
          "The shortage of research funding",
          "What journals choose to publish",
          "Incentives and unrepeated work",
        ], correct: "Incentives and unrepeated work" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "A ___ share of the checked findings failed to hold up.",
        options: ["sizeable", "seasonal", "sensible", "separate"], correct: "sizeable" },
    ]),

  item("What convenience conceals — C2", "STRETCH",
    [
      "Same-day delivery appears efficient because its costs fall outside the price paid.",
      "A vehicle carrying one parcel travels almost as far as one carrying forty.",
      "Consolidated deliveries are cheaper and cleaner, but slower, and slowness is unsaleable.",
      "Retailers who tried scheduling deliveries weekly lost customers to those who did not.",
      "No individual purchase is unreasonable; the aggregate is what does the damage.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "The figure on the label ___ what the delivery really costs.",
        options: ["covers", "hides", "meets", "shows"], correct: "hides" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the fourth one?",
        options: [
          "Shoppers reliably choose the slower, cleaner option.",
          "The advantage disappeared as soon as rivals copied it.",
          "Competition punishes whoever moves first on this.",
          "Weekly scheduling proved popular with every retailer.",
        ], correct: "Competition punishes whoever moves first on this." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence indicates where the writer locates the real harm?", correctSentence: 5 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement best expresses the writer's argument?",
        options: [
          "Retailers deliberately conceal the true cost of fast delivery.",
          "Consumers who order frequently are behaving irresponsibly.",
          "Delivery vehicles should be limited by law to full loads.",
          "A rational choice repeated by millions produces an irrational result.",
        ], correct: "A rational choice repeated by millions produces an irrational result." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Why speed is hard to give up",
          "Scheduling deliveries by the week",
          "How retailers set their prices",
          "The arithmetic of a half-empty van",
        ], correct: "Why speed is hard to give up" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "A slower service is one that customers will not ___.",
        options: ["chase", "choose", "charge", "change"], correct: "choose" },
    ]),

  item("Reading against the archive — C3", "STRETCH",
    [
      "An archive preserves what somebody once thought worth preserving.",
      "Ledgers and licences survive; conversations and refusals rarely do.",
      "A historian who reads only what remains will describe a world of paperwork.",
      "The absences are evidence too, provided they are treated as absences rather than as silence.",
      "Whole populations appear in the record only when they were taxed, tried, or buried.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "What is missing can still ___ the historian something.",
        options: ["lose", "blur", "tell", "hide"], correct: "tell" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence indicates the circumstances under which some groups were recorded at all?", correctSentence: 5 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement best expresses the writer's argument?",
        options: [
          "Records of taxation are the most reliable historical source.",
          "Most historical writing concentrates too heavily on paperwork.",
          "Historians should rely on official documents wherever possible.",
          "Archives are incomplete, and what is missing must be read as well.",
        ], correct: "Archives are incomplete, and what is missing must be read as well." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the third one?",
        options: [
          "Such an account mistakes the surviving part for the whole.",
          "Paperwork is the most vivid material any archive holds.",
          "That description would be accurate for every period.",
          "Historians have generally avoided written documents.",
        ], correct: "Such an account mistakes the surviving part for the whole." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "The reliability of official ledgers",
          "What the record leaves out",
          "Taxation and the written word",
          "Preserving documents for the future",
        ], correct: "What the record leaves out" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Spoken exchanges leave ___ trace in an institutional record.",
        options: ["lengthy", "lasting", "little", "legible"], correct: "little" },
    ]),

  item("The case for a quieter street — C4", "STRETCH",
    [
      "Traffic noise is habitually classified as a nuisance rather than an exposure.",
      "Longitudinal cohorts associate it with fragmented sleep and elevated arterial pressure.",
      "Residents habituate to the sound; the physiological response demonstrably does not.",
      "Objections invariably invoke congestion, an assertion the modelling does not substantiate.",
      "The benefit accrues disproportionately to households absent from every consultation.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "People grow used to the sound, yet the bodily reaction ___.",
        options: ["subsides", "reverses", "vanishes", "persists"], correct: "persists" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs at the end of the text?",
        options: [
          "Those who attend are seldom those with most to gain.",
          "Nobody living on a quiet street notices any difference.",
          "The objections raised at such meetings are usually correct.",
          "Consultation meetings represent a whole neighbourhood fairly.",
        ], correct: "Those who attend are seldom those with most to gain." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence indicates what the objectors normally raise?", correctSentence: 4 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement best expresses the writer's argument?",
        options: [
          "Consultation meetings should be made compulsory for residents.",
          "A health effect is being treated as a matter of preference.",
          "Congestion is the strongest argument against reducing traffic.",
          "Traffic noise annoys residents more than they usually admit.",
        ], correct: "A health effect is being treated as a matter of preference." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Congestion and its critics",
          "Sleeping beside a main road",
          "Noise as a health question",
          "Who attends a consultation",
        ], correct: "Noise as a health question" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Objections generally ___ congestion as the reason.",
        options: ["cure", "cede", "curb", "cite"], correct: "cite" },
    ]),

  item("What the score does not carry — C5", "STRETCH",
    [
      "A numeral attached to a pupil outlives the judgement that generated it.",
      "Teachers record; administrators aggregate; allocation mechanisms distribute places accordingly.",
      "Each transformation discards the reasoning underlying the original figure.",
      "By the terminal stage the numeral is construed as an intrinsic attribute.",
      "Measurement is not the pathology; amnesia about what was measured is.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "At each step the original thinking is quietly ___.",
        options: ["lost", "kept", "read", "sent"], correct: "lost" },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence indicates what the writer does not object to?", correctSentence: 5 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement best expresses the writer's argument?",
        options: [
          "Administrators aggregate marks without understanding them properly.",
          "A figure outlives its reasoning and is then mistaken for a fact.",
          "Teachers record marks that are far too coarse to be useful.",
          "Assessment of pupils should be abandoned in favour of description.",
        ], correct: "A figure outlives its reasoning and is then mistaken for a fact." },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the fourth one?",
        options: [
          "Administrators routinely consult the original teacher.",
          "Nobody at any stage relies on the figure at all.",
          "The context that gave it meaning has long since gone.",
          "Its meaning is preserved carefully at every stage.",
        ], correct: "The context that gave it meaning has long since gone." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "The case against all assessment",
          "Allocating places in a system",
          "How teachers record their marks",
          "A number that outlives its meaning",
        ], correct: "A number that outlives its meaning" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "By the last stage the figure is treated as a ___ of the child.",
        options: ["property", "priority", "prophecy", "procedure"], correct: "property" },
    ]),

  item("Restoring what cannot return — C6", "STRETCH",
    [
      "Ecological restoration is habitually characterised as reinstating a prior landscape condition.",
      "That condition was itself a transient interval within continuous ecological flux.",
      "Selecting a baseline century is a cultural judgement presented as an empirical one.",
      "Practitioners who concede this openly attract disproportionate professional criticism.",
      "A reinstated wetland performs hydrologically irrespective of the baseline chosen.",
    ],
    [
      { kind: "COMPLETE_THE_SENTENCES", stem: "A cultural choice is ___ up as an empirical one.",
        options: ["dropped", "dressed", "drawn", "driven"], correct: "dressed" },
      { kind: "COMPLETE_THE_PASSAGE", stem: "Which line belongs after the third one?",
        options: [
          "Cultural considerations play no part in the decision.",
          "Ecologists agree entirely on which period to select.",
          "No single year is the one a landscape naturally returns to.",
          "The scientific literature settles the question directly.",
        ], correct: "No single year is the one a landscape naturally returns to." },
      { kind: "HIGHLIGHT_THE_ANSWER", stem: "Which sentence indicates that the outcome may not depend on the baseline chosen?", correctSentence: 5 },
      { kind: "IDENTIFY_THE_IDEA", stem: "Which statement best expresses the writer's argument?",
        options: [
          "Landscapes cannot be restored once they have been altered.",
          "Practitioners who admit uncertainty are treated unfairly by critics.",
          "Ecological science is unable to identify any historical baseline.",
          "Restoration projects should be judged on function, not on fidelity.",
        ], correct: "Restoration projects should be judged on function, not on fidelity." },
      { kind: "TITLE_THE_PASSAGE", stem: "Which title fits the whole text best?",
        options: [
          "Choosing a past to restore",
          "The science of former landscapes",
          "Wetlands and their functions",
          "Criticism among practitioners",
        ], correct: "Choosing a past to restore" },
      { kind: "COMPLETE_THE_SENTENCES", stem: "Being honest about this tends to be ___.",
        options: ["predicted", "punished", "promoted", "protected"], correct: "punished" },
    ]),
];

async function main() {
  if (ITEMS.length === 0) {
    console.log("No Interactive Reading sets authored yet — nothing to seed.");
    return;
  }
  const existing = await prisma.detItem.count({ where: { taskType: "INTERACTIVE_READING" } });
  if (existing > 0) {
    console.log(`Already ${existing} Interactive Reading items — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Interactive Reading items.`);
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
