// Seeds original "Interactive Listening" conversations.
//
// ONE REFERENCE CONVERSATION ON PURPOSE. This item exists to prove the pipeline
// end to end — payload shape, audio manifest, projection, grading, four gates —
// before eleven more are authored against it. A type with one item does not
// clear Rule 7 on its own; Listen and Type already carries Listening past the
// floor, so this is additive and blocks nothing.
//
// WHAT ONE ITEM CONTAINS
//   A  Listen and Complete   a scenario clip plus a transcript with 3-4
//                            WHOLE-WORD gaps.
//   B  Listen and Respond    5-6 turns. Turn 1 is the OPENER: no audio, no line.
//   C  Summarize             free text, AI-rated against a server-only
//                            reference and key points.
//
// AUTHORING CONTRACT — enforced by gate:il-leak, gate:il-options,
// gate:il-cloze-audio and gate:il-audio-coverage:
//   · 3-4 blanks in Part A, each a real English word, letters/hyphen/apostrophe
//     only, and each a WHOLE word — the literal chunk before a gap must end at a
//     word boundary. No prefix is ever revealed: the audio supplies the word, so
//     showing part of it turns a listening gap into a spelling puzzle.
//   · Every blanked word must appear verbatim in what the voice actually says.
//     If you write `complete.audioScript` to make the delivery sound natural, it
//     must still contain every blanked word or the item is unanswerable.
//   · 5-6 turns; exactly one carries `opener: true`, with `seg: null` and
//     `line: null`. Every other turn has both a `seg` and a `line`.
//   · >= 3 options per turn, no two the same, `correct` an index into them.
//   · The correct option must not be the LONGEST — "pick the longest answer" is
//     the oldest multiple-choice heuristic there is and needs no English. The
//     gate measures this bank-wide rather than per turn, so honest variation
//     survives but the tell does not.
//   · `seg` labels are "scenario" and "turn-N" (N matching the turn's position,
//     1-based). They map to DetItemAudio's integer seg; anything else is
//     unrenderable and the gate says so.
//
// NEVER AUTHORED HERE: audioUrl. It is DB-only, written by
// scripts/generate-det-audio.mts into DetItemAudio, and merged into the client
// payload at the render seam. A seed cannot reach that table, so the rule is
// enforced by shape rather than by convention.
//
// Run: npm run seed:interactive-listening  (needs DATABASE_URL set)

import { PrismaClient, Prisma } from "@prisma/client";
import { isDirectRun } from "./_entry";
import { loadAuthoredScenarios, type ILSource } from "./interactive-listening.loader";

const prisma = new PrismaClient();

const PROMPT =
  "Listen to the message and fill the gaps, reply at each turn, then summarize the conversation.";

const GUIDANCE =
  "You hear each part once. Type the exact word you hear in each gap, then choose the reply that keeps the conversation moving.";

/** The reference conversation, authored inline and proven end to end before the
 *  rest were written. Kept here rather than folded into the data file: it is the
 *  worked example the authoring contract at the top of this file describes, and
 *  it is what the gate fixtures are derived from. */
const REFERENCE: Prisma.DetItemCreateManyInput[] = [
  {
    taskType: "INTERACTIVE_LISTENING",
    title: "Group project — booking the study room",
    prompt: PROMPT,
    difficulty: "CORE",
    topicTag: "study",
    guidanceNote: GUIDANCE,
    payload: {
      scenario: {
        register: "casual",
        setting: "Two classmates after history class",
        speakerName: "Maya",
        youAre: "Sam",
      },
      complete: {
        seg: "scenario",
        text: [
          "Hey, it's Maya. I'm calling about the group project for our history class. I reserved a study room in the ",
          { missing: "library" },
          " for tomorrow at four, but I just found out it's only free until five-thirty. Could you bring your ",
          { missing: "laptop" },
          " and the notes from last week? I'll handle the ",
          { missing: "slides" },
          " if you can write the ",
          { missing: "summary" },
          ". Let me know if that works. Thanks!",
        ],
      },
      turns: [
        {
          seg: null,
          opener: true,
          line: null,
          options: [
            "Hi Maya, I got your message about the study room — I can make it at four.",
            "Why did you only book the room until five-thirty, and not for the whole afternoon?",
            "I don't really enjoy our history class this term, if I am being completely honest.",
          ],
          correct: 0,
        },
        {
          seg: "turn-2",
          line: "Great, thanks for calling back! Did you manage to get the notes from last week's lecture?",
          options: [
            "Yes, I saved them, and I'll bring my laptop along too.",
            "The library usually closes at five-thirty on weekdays.",
            "I really think you should be the one to write the summary.",
          ],
          correct: 0,
        },
        {
          seg: "turn-3",
          line: "Perfect. I was thinking we split it — I build the slides, you write the summary. Fair?",
          options: [
            "That sounds fair; I'll start the summary once we go through the notes.",
            "Honestly, I would rather not do any of the writing this time, so please count me out.",
            "Wait — what slides are you actually talking about?",
          ],
          correct: 0,
        },
        {
          seg: "turn-4",
          line: "One problem — the room's only free until five-thirty, so we get about ninety minutes. Enough?",
          options: [
            "It's tight, but if we focus we can finish the main points in time.",
            "No — ninety minutes is nowhere near enough, so let's just cancel it.",
            "Ninety minutes is basically three hours, so we're completely fine.",
          ],
          correct: 0,
        },
        {
          seg: "turn-5",
          line: "Sounds good. Should we invite Daniel, or keep it just the two of us?",
          options: [
            "Let's keep it to us for now and share the finished work with Daniel.",
            "Sorry — who exactly is Daniel, and have I actually met him before today?",
            "Don't worry, I already finished the entire project on my own last night.",
          ],
          correct: 0,
        },
      ],
      summarize: {
        prompt: "In your own words, summarize the conversation you just had.",
        reference:
          "Maya and Sam are classmates planning a history group project. They will meet in a library study room the next day at four. Maya will make the slides and Sam will write the summary. Because the room is free only until five-thirty, they will focus on the main points and finish the rest by email, keeping the meeting to just the two of them.",
        keyPoints: [
          "who: Maya and Sam, classmates",
          "purpose: plan a history group-project meeting",
          "split: Maya does slides, Sam writes the summary",
          "constraint: room only until 5:30 → focus main points, finish rest by email",
        ],
      },
    } as unknown as Prisma.InputJsonValue,
  },
];

// Cowork's authored scenarios, when the data file has been dropped in. Absent =
// the reference alone, which is exactly the state this type shipped in.
const authored = loadAuthoredScenarios({
  prompt: PROMPT,
  guidanceNote: GUIDANCE,
  reservedTitles: REFERENCE.map((i) => i.title),
});

/** Where the bank came from. Printed by `npm run seed:il-check` so "1 item"
 *  never gets mistaken for "12 items and the gates passed". */
export const IL_SOURCE: ILSource & { referenceCount: number; totalCount: number } = {
  ...authored.source,
  referenceCount: REFERENCE.length,
  totalCount: REFERENCE.length + authored.items.length,
};

export const ITEMS: Prisma.DetItemCreateManyInput[] = [...REFERENCE, ...authored.items];

async function main() {
  const existing = await prisma.detItem.count({
    where: { taskType: "INTERACTIVE_LISTENING" },
  });
  if (existing > 0) {
    console.log(`Already ${existing} Interactive Listening item(s) — skipping.`);
    return;
  }
  await prisma.detItem.createMany({ data: ITEMS });
  console.log(`Seeded ${ITEMS.length} Interactive Listening item(s).`);
  console.log(
    "Audio is NOT seeded here — run `npm run audio:render` to render the scenario " +
      "and turn clips into DetItemAudio.",
  );
}

if (isDirectRun(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
