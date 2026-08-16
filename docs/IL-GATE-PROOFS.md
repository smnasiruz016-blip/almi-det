# Interactive Listening — how each gate was proven RED

A gate that has only ever been seen green is not a gate. This repo has shipped three of those
already; the rule since is that no check is trusted until it has been watched to fail on a bank
that deserves to fail. This file records what was done to each Interactive Listening check and
what it printed, so any of it can be reproduced rather than taken on trust.

Two mechanisms, and the difference matters:

**DATA FIXTURE** — `npm run gate:fixtures` derives a bank from the real content with exactly one
thing broken, and the gate runs against it. Fixture JSON is gitignored on purpose: it is derived,
never authored, so it cannot drift away from the shape of real content.

```
GATE_FIXTURE=scripts/gates/fixtures/<name>.json npx tsx scripts/gates/all.mts --only=<gate>
```

**CODE SABOTAGE** — five checks describe properties of *code*, not of content, and no JSON file
can trip them. For those the source was edited, the gate run, the output recorded, and the edit
reverted. Where that is the case it is said so plainly below rather than dressed up as a fixture.

---

## The delivery model these checks defend

Interactive Listening does **not** ship its item to the browser. `toClientPayload()` returns
Stage A only — the scenario, the gapped transcript and the scenario clip. Each turn is released
by `POST /api/det/il/advance` when it is reached, and the summary prompt last of all.

That is not cosmetic. Several reply options legitimately name words that were blanked in Part 1
("The library usually closes at five-thirty" against a gap keyed `library`), because it is one
conversation and topic words recur — that is what makes it coherent. Under a single payload,
Part 1 would be answerable by reading the wire. Under progressive delivery it is not, and the
protection is structural rather than a rule about vocabulary.

Measured on the reference conversation: the Stage A wire is **770 bytes**; the stored payload is
**2,905**. The difference is the part of the test that has not happened yet.

`prepareResponse` on the registry handler closes the other end: Parts 1 and 2 are read from the
database at scoring time, so the final submit cannot post its own answers for stages that are
already locked.

---

## gate:il-leak

Interactive Listening is delivered **progressively**, so this gate checks three
projections per item — Stage A, every turn view, and the summarize view. The turns never
pass through `toClientPayload()`, so a gate that only looked there would be blind to the half
of the wire that carries the conversation.

| Check | Proof | Output on the broken bank |
|---|---|---|
| IL-L3 server-only value on the wire | fixture `il-red-leak-line.json` — a turn's spoken line pasted into one of its options | `[FAIL] IL-LEAK-VALUE` · `turns[2].line: value reaches the client verbatim` |
| IL-L1 forbidden key | **code sabotage** — projector emits `line`, `correct`, `missing`, `reference`, `keyPoints` | `[FAIL] IL-LEAK-KEY-FIELD` — all five named separately: `"line" appears as a key in the client payload`, and the same for `correct`, `reference`, `keyPoints`, `missing` |
| IL-L2 field whitelist | same sabotage | `[FAIL] IL-LEAK-SHAPE` · e.g. `complete.text[1]: unexpected field "missing" projected` |
| IL-L5 nothing released early | **code sabotage** — `projectILView` regressed to the single-payload model (`turns` emitted in Stage A) | `[FAIL] IL-STAGE-RELEASED-EARLY` · 15 problems · `Stage A: turns[0].options[0] is already on the wire before Part 1 is submitted` — plus `IL-LEAK-SHAPE: Stage A (root): unexpected field "turns" projected` |
| IL-L6 one turn per turn view | **code sabotage** — `projectILTurn` appends the next turn's options | `[FAIL] IL-STAGE-RELEASED-EARLY` · 12 problems · `turn 1: carries an option belonging to turn 2` — plus `IL-OPTIONS-NOT-PERMUTED` |

Every sabotage was reverted and the gate re-run green before committing.

**IL-L5 is the check that guards the delivery model.** It is what would catch a future
change quietly reverting Interactive Listening to a single payload — which would look like a
simplification and would silently turn Part 1 back into a search through the wire, because
several reply options name the words that were blanked.

**Why the key fields are checked structurally and not by scanning the wire.** The blanked word
`library` appears legitimately inside a turn option (*"The library usually closes at
five-thirty"*). A substring scan for the Part A key fires on correct, shipped content — and this
repo's own history is that a gate which cries wolf gets switched off. In the other direction,
`turn.correct` is a small integer: scanning the wire for `0` proves nothing. So the shape is
compared against a whitelist level by level, and only the long-form secrets (`line`, `reference`,
`keyPoints`) get an additional value scan.

---

## gate:il-options

| Check | Proof | Output on the broken bank |
|---|---|---|
| O1 duplicate options | fixture `il-red-options-dupe.json` | `[FAIL] IL-OPTIONS-MALFORMED` · `turn 2: duplicate option text` |
| O1 conversation structure | fixture `il-red-turns-opener.json` | `[FAIL] IL-TURN-STRUCTURE` · `2 turn(s) marked opener, exactly 1 required` |
| O2 length tell | fixture `il-red-options-longest.json` | `[FAIL] IL-LENGTH-TELL` · `the longest option in 100% of turns`, all five turns listed |
| O3 displayed-position bias | **code sabotage** — `turnOrder()` made the identity permutation | `O3 key position AS DISPLAYED : #1→5` → `[FAIL] IL-POSITION-BIAS: 100% of correct replies are DISPLAYED in position 1` |
| O4 answer round-trip | **code sabotage** — grading mapped `order.indexOf(displayed)` instead of `order[displayed]` | `[FAIL] IL-ANSWER-UNGRADABLE` · `turn 2: picking the correct reply where it is DISPLAYED (position 2) is marked wrong` |

**O3 cannot be broken from data, and that is the design.** The permutation is a rotation whose
phase is hashed from the scenario, so consecutive turns place the key at consecutive positions:
balance holds for *any* authored content. A seeded shuffle would give no such guarantee — with
five turns it can land three keys in one position by chance. The check still earns its place
because it catches the permutation being weakened or removed, which is exactly what the sabotage
simulated.

**O4 caught a real bug in itself.** The first version referenced an undestructured variable and
the gate reported `projection threw … item is not defined` rather than passing. That is the
correct failure mode and worth recording: the gate failed loudly instead of going green on a
check it was not actually running.

Under the inverted-mapping sabotage only **3 of 5** turns failed — a rotation with shift 0 is its
own inverse, so the two turns whose key was already displayed first still round-tripped. The
check is measuring real behaviour, not a formula.

---

## gate:il-cloze-audio

| Check | Proof | Output on the broken bank |
|---|---|---|
| A1 blank count | fixture `il-red-cloze-count.json` | `[FAIL] IL-CLOZE-BLANK-COUNT` · `2 blank(s), rule is 3-4` |
| A2 real word | fixture `il-red-cloze-notword.json` | `[FAIL] IL-CLOZE-NOT-A-WORD` · `b2: "zqxvlorn" is not in the English word list` |
| A4 prefix reveal | fixture `il-red-cloze-prefix.json` — `"…room in the li" + [brary]` | `[FAIL] IL-CLOZE-PREFIX-REVEAL` · `b1: the text before the gap ends mid-word ("…room in the li"), so part of "brary" is already on screen` |
| A5 word in the audio | fixture `il-red-cloze-audio.json` — an `audioScript` saying *visuals* where the key is *slides* | `[FAIL] IL-CLOZE-NOT-IN-AUDIO` · `b3: "slides" does not appear in what the voice says (complete.audioScript overrides the transcript)` |

A3 (typable key) has no fixture of its own: the payload schema already rejects the characters it
guards, so it is a second line of defence rather than the first. Said here rather than left to
look like coverage it does not have.

**A5 is satisfied for free on an item with no `audioScript`** — the spoken text *is* the
assembled transcript, so the word is present by construction. It becomes load-bearing the moment
an author writes an `audioScript` to make the delivery sound natural: paraphrase a blanked word
away and the item is unanswerable as spoken, with nothing else in the pipeline to say so.

The prefix-reveal fixture trips **three** checks at once (`brary` is not a word, is not a
standalone word in the audio, and leaves a prefix on screen). One change, three findings — the
fixture still changes exactly one thing.

---

## gate:il-audio-coverage

| Check | Proof | Output on the broken bank |
|---|---|---|
| C1 label valid | fixture `il-red-audio-badlabel.json` | `[FAIL] IL-AUDIO-BAD-LABEL` · `seg "middle-bit" is not a segment label` |
| C2 missing clip | fixture `il-red-audio-silentturn.json` — a turn that names a clip but has nothing to say | `[FAIL] IL-AUDIO-MISSING-CLIP` · `turn 4 ("turn-4") needs seg 4, which the audio manifest would not render` |
| C4 seg collision | fixture `il-red-audio-segcollision.json` | `[FAIL] IL-AUDIO-SEG-COLLISION` · `seg 2 is claimed by turn 2 and turn 5` |
| C5 label names its turn | same fixture | `[FAIL] IL-AUDIO-SEG-MISMATCH` · `turn 5: labelled "turn-2"` |
| C6 opener shape | `il-red-audio-silentturn.json` | `[FAIL] IL-AUDIO-OPENER-SHAPE` · `turn 4: no line to speak, so its clip would be empty` |
| C3 orphan clip | **code sabotage** — the manifest made to emit an extra unit | `[FAIL] IL-AUDIO-ORPHAN-CLIP` · `the manifest would render seg 97 ("turn-97") that no part of the payload plays` |

**C3 cannot currently be broken from data** because the manifest is derived from the same payload
the references come from, so the two agree by construction. It is a guard against that stopping
being true — a second speaker's voice, or a summary read aloud, would give the manifest a source
the payload does not name. Recorded here so nobody later reads a permanently-green check as
coverage.

The whole point of `src/lib/det/audio-units.ts` is that this gate reads the **same function the
generator loops over**, not a description of it. A gate that models what the generator "probably
does" tests the model.
