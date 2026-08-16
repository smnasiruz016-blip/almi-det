# Speaking — how each gate was proven RED

Same rule as the other two proof files: a check is not trusted until it has been watched to fail.

**DATA FIXTURE** — `npm run gate:fixtures` derives a bank with one thing broken.
**CODE SABOTAGE** — for the checks that describe properties of *code*, the source was edited, the
gate run, the output recorded, and the edit reverted.

---

## Why cost control is part of the scaffold

Speaking is the only skill where **an attempt costs money before it can be graded**. A reading
item is marked from data already in the database; a spoken one has to be uploaded and transcribed
first, and that transcription is billed whether or not the answer turns out to be any good.

So the guards are not only about entitlement — their **order** is the cost control:

```
1. paid access   refuse before anything is spent
2. daily cap     refuse before anything is spent
3. transcribe    the only billed step, metered on every exit path
4. grade
```

A refusal issued *after* the Whisper call costs exactly as much as an accepted attempt, and
nothing on the invoice would say so. `SPEAKING_DAILY_CAP` (40/user/day, all speaking types) lives
in one place, `src/lib/det/speaking.ts`.

## No gate makes a live Whisper call

`runSpeakingAttempt` takes its transcriber and its attempt counter as **arguments**. The gates
hand it a stub that records that it was called and returns a canned string, so the real ordering
logic runs with no OpenAI, no database and no spend. Verified: `grep -rn "fetch(" scripts/gates/`
returns nothing — no gate performs a network request at all.

---

## gate:speaking-access

| Check | Proof | Output on the broken build |
|---|---|---|
| SA1 unpaid refused, unbilled | **code sabotage** — transcribe moved above the paid check | `SA1 unpaid refused : 402 UNPAID, transcriber calls=1` → `[FAIL] the transcriber ran 1 time(s) for an UNPAID user — a refusal that costs money` |
| SA2 over-cap refused, unbilled | same sabotage | `[FAIL] the transcriber ran 1 time(s) for an OVER-CAP attempt — the cap did not bound spend` |
| SA3 cap boundary inclusive | **code sabotage** — `used >= cap` → `used >= cap - 1` | `SA3 cap-th attempt allowed : REFUSED` → `[FAIL] attempt 40 of 40 was refused — off by one, a user loses their last attempt` |
| SA4 happy path grades once | covered by the SA1 sabotage | `[FAIL] the transcriber ran 2 time(s) for one attempt — expected exactly 1` |
| SA5 both routes guarded | **code sabotage** — the guard block deleted from `/api/det/submit` | `[FAIL] SPEAKING-ROUTE-UNGUARDED … its handler does not apply the paid gate and daily cap` |

**Note what SA1's sabotage did NOT break.** The status codes stayed correct — 402 and 429, exactly
as before. The refusal was still a refusal; it had simply already been paid for. A check that only
asserted "unpaid gets 402" would have passed the sabotaged build. Asserting that the transcriber
was never reached is what catches it.

### SA5 was green and blind on its first version

Deleting the guard block from `/api/det/submit` produced **`SA5 … clean`**. The check grepped the
whole file for `isSpeakingTask` and `SPEAKING_DAILY_CAP` — and the **import line still named both**.
It was matching its own scaffolding.

Fixed by slicing from `export async function POST` (which drops the imports) and asserting the
**call** `isSpeakingTask(attempt.taskType)` and a `status: 429` rather than the identifiers. Re-run
against the same sabotage, it fails. Recorded because it is the fourth time in this audit that a
check needed to be watched failing before it was worth anything.

---

## gate:speaking-metered

| Check | Proof | Output on the broken build |
|---|---|---|
| SM1 every exit path metered | **code sabotage** — the HTTP-failure `recordTranscriptionCost` removed | `SM1 … 2/3 recordTranscriptionCost call(s)` → `[FAIL] a path that throws before recording still cost money` |
| SM2 refusals never transcribe | **code sabotage** — transcribe above the guards | `SM2 refusals never transcribe : 2 billed refusal(s)` |
| SM3 one ledger label per type | **code sabotage** — Read Aloud given the photo task's label | `[FAIL] ledger feature "speak-about-photo.transcribe" is shared by READ_ALOUD and SPEAK_ABOUT_THE_PHOTO — a per-feature total would not be about either` |
| SM4 one transcription caller | **code sabotage** — a second file containing the endpoint | `SM4 … 2 file(s)` → `[FAIL] each one is a separate place to forget the ledger` |

SM1 and SM4 are **source checks** and are labelled as such in the gate. Proving them behaviourally
would mean faking OpenAI's HTTP responses, and a gate that mocks a vendor tests the mock.

`transcribeAudio`'s ledger label was **parameterised** as part of this work. It was hardcoded to
`speak-about-photo.transcribe`, so a Read Aloud call would have been billed to the photo task —
the same accounting defect already fixed once in the TTS generator. SM3 is what stops it coming
back.

---

## gate:read-aloud-content

| Check | Fixture | Output |
|---|---|---|
| RA1 present | `ra-red-empty.json` | `[FAIL] READ-ALOUD-EMPTY` |
| RA2 say-able in one breath | `ra-red-toolong.json` | `[FAIL] READ-ALOUD-TOO-LONG … scored against a recording that was cut off` |
| RA3 terminal punctuation | `ra-red-noterminal.json` | `[FAIL] READ-ALOUD-NO-TERMINAL` |
| RA4 pronounceable words | `ra-red-notword.json` | `[FAIL] READ-ALOUD-NOT-A-WORD` |
| RA5 no duplicate | `ra-red-duplicate.json` — the item cloned under a new title | `[FAIL] READ-ALOUD-DUPLICATE` |

RA4 **exempts capitalised tokens** as proper nouns. A word list has no names in it, so checking
every token would fail on any sentence containing one — the same false positive that made
`gate:il-cloze-audio` report `check-up` as not a word. RA5's fixture had to **add** an item, for
the same reason the writing duplicate fixture did: a cross-item check cannot be moved by mutating
one item.

---

## gate:speaking-leak — a STUB, and it says so

Read Aloud is the only speaking type today and it has **nothing to hide**: the sentence is the
stimulus, on screen, because reading it aloud is the task. A leak check over it would report green
forever while looking like coverage.

The gate is wired into `gate:all` now so that the first speaking type with a rubric —
Speaking Sample, Interactive Speaking — finds a place to put the check rather than a decision
about whether to bother. It prints what it is watching for and states that none of those types
exist yet, and it **fails** if one appears while the checks are still unwritten.
