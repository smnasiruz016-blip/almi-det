# Interactive Writing & Writing Sample — how each gate was proven RED

Same rule as `IL-GATE-PROOFS.md`: a check is not trusted until it has been watched to fail on a
bank that deserves to fail.

**DATA FIXTURE** — `npm run gate:fixtures` derives a bank from the real content with one thing
broken. Fixture JSON is gitignored; it is derived, never authored.

```
GATE_FIXTURE=scripts/gates/fixtures/<name>.json npx tsx scripts/gates/all.mts --only=<gate>
```

**CODE SABOTAGE** — three checks describe properties of *code*. No JSON can trip them, so the
source was edited, the gate run, the output recorded, and the edit reverted.

---

## What these gates defend

Both types carry `rubric.reference`: prose describing what a strong answer does, which the AI
rater marks against. That is an answer key under a different name — the same class of field as
the photo tasks' `imageAlt`, which this repo already had to stop rendering as alt text. A taker
who reads *"opens with a clear thesis naming one skill, develops two reasons with concrete
examples"* has been handed the mark scheme.

Interactive Writing also withholds by **time**. Part 2 asks the taker to concede a genuine
advantage of the option they rejected and to mitigate the downside they themselves raised.
Someone who reads that first writes a Part 1 built to be easy to reverse — hedged, downside
chosen for convenience — and the pair measures nothing. Measured on the reference item: the
Part 1 wire is **309 bytes**; the stored payload is **824**.

---

## gate:writing-leak

| Check | Proof | Output on the broken bank |
|---|---|---|
| WL3 rubric text on the wire | fixture `wr-red-leak-reference.json` — `rubric.reference` pasted into Part 1's prompt, which *is* projected | `[FAIL] WRITING-LEAK-VALUE: Rubric text crossed to the client inside an allowed field.` |
| WL1 forbidden key + WL2 whitelist | **code sabotage** — `projectIWView` emits `rubric` | `WL1 … 6 leak(s)`, `WL2 … 2 problem(s)`, `WL3 … 10 leak(s)` · `"rubric" appears as a key in the projection`, and the same for `reference` and `traits` |
| WL4 Part 2 withheld | **code sabotage** — `part2` released regardless of stage | `[FAIL] WRITING-STAGE-RELEASED-EARLY` · `"part2" is populated on a fresh attempt` · `Part 2's prompt is on the wire before Part 1 is submitted` |
| WL5 practice note present | **code sabotage** — `practiceNote` emitted empty | `[FAIL] WRITING-SAMPLE-NOTE-MISSING` · `practiceNote is not the canonical sentence` |

**WL5 is the odd one out and belongs here anyway.** Every other check in this gate requires
something to be *absent*; WL5 requires something to be *present*. In the official DET the Writing
Sample is sent to institutions **unscored**. We grade it, which is right for a practice tool — but
if the sentence saying so is dropped in a redesign, nothing breaks, no test fails, and the product
quietly implies the real exam scores this. That is why the sentence lives in the projected payload
(`WRITING_SAMPLE_NOTE`) rather than in the composer's copy, and why a leak gate checks it.

---

## gate:writing-prompts

| Check | Proof | Output on the broken bank |
|---|---|---|
| WP1 prompt present | fixture `wr-red-prompt-empty.json` | `[FAIL] WRITING-PROMPT-MISSING: A prompt is empty or too short to set a task.` |
| WP2 readable in the time | fixture `wr-red-prompt-toolong.json` | `[FAIL] WRITING-PROMPT-TOO-LONG` — Writing Sample's cap is tighter because its prompt must be readable inside the 30-second prep window |
| WP3 IW parts differ | fixture `wr-red-prompt-identical.json` | `[FAIL] WRITING-PARTS-IDENTICAL` — and `WRITING-PROMPT-DUPLICATE` alongside it, since the two parts are then the same prompt twice |
| WP4 no duplicate prompt | fixture `wr-red-prompt-duplicate.json` — the Writing Sample item cloned under a new title | `[FAIL] WRITING-PROMPT-DUPLICATE: The same prompt appears on more than one item.` |
| WP5 rubric usable | fixture `wr-red-rubric-empty.json` | `[FAIL] WRITING-RUBRIC-UNUSABLE: Without a reference the AI rater has no target and marks on a general impression.` |

**WP4's fixture had to ADD an item.** The bank holds one of each new type, and a cross-item
duplicate check cannot be moved by mutating a single item — the same lesson the Interactive
Listening length-tell fixture taught when the bank grew from 1 to 12. A check that compares items
needs a fixture with more than one.

## What the full bank found that one item could not

The 11 authored items per type arrived after the gates were written. Running the gates over them
changed WP6, and the way it changed is the point.

**The first WP6 was a phrase list** — `"the option you"`, `"you mentioned"`, `"opposite"` and so
on — and on real content it flagged **7 of 12** Interactive Writing items. Five of those seven
were plainly dependent on Part 1 and the list simply did not know the words: *"this hobby"*,
*"your usual method"*, *"your method"*, *"the other actor"*, *"Whatever you argued"*. A check that
is wrong 70% of the time is a check someone switches off.

The signal that actually separates them is simpler than any phrase list. A Part 2 that builds on
Part 1 either **addresses the candidate** (`you` / `your`) or **points at something already
established** (`this` / `that` / `the other` / `the opposite`). One that does neither reads as a
fresh standalone question. Measured on the 12 items as first authored: 10 carried at least one,
and the 2 that carried none — *Devices in class* and *Online university study* — were the two that
genuinely stood alone. Both were then re-authored to reference Part 1 explicitly, and WP6 now
reports **0 standalone across all 12**. The warning did its job and went quiet, which is the
outcome an advisory check is for.

Same lesson as the Interactive Listening hyphen fix, one type over: **fixtures prove a gate CAN
fire; real content shows whether it is aimed at the right thing.**

**WP6 is a WARN, deliberately.** It flags an Interactive Writing Part 2 with no wording that
refers back to Part 1, because a genuinely free-standing Part 2 means the whole locked design is
protecting nothing. But it is a heuristic on prose, and a gate that blocks a build over word
choice is a gate someone switches off.

---

## The staged kernel is shared, not copied

Interactive Writing reuses Interactive Listening's machinery rather than repeating it:
`src/lib/det/staged.ts` (progress, answer merge, the `StageDriver` contract),
`src/lib/det/staged-drivers.ts` (the registry), `POST /api/det/staged/advance` (one
task-agnostic route), and `useStagedAttempt` on the client. The old `/api/det/il/advance` is
gone; Interactive Listening now goes through the generic route.

That refactor was re-verified behaviourally, not assumed: a scripted walk re-drove Interactive
Listening through the generic driver and confirmed Stage A still advances to Stage B and a second
Stage A submission is still refused.
