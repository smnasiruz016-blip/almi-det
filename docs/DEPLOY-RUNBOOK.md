# AlmiDET — production content-deploy runbook

**Status: NOT YET RUN.** Content is accumulating on `audit/det-masterclass`. One careful
production deploy happens at the END, once all task types are built — never piecemeal.

This file is appended to as each type lands. If a step is not written here, it does not
happen on the day.

---

## Why this exists

Two facts make a casual deploy dangerous:

1. **Preview points at the production database.** Preview and Production resolve to the same
   Neon endpoint (`ep-fancy-sea-ahp91es4`, project `rough-art-02116548`). A preview build runs
   `prisma migrate deploy` against **production**, and an admin action taken "while testing" on
   a preview URL is a real action on a real user.
2. **Seeding is manual and NOT idempotent in the way people assume.** `scripts/seed/append.ts`
   dedupes on `(taskType, title)`. Re-authored content with NEW titles is therefore **inserted
   alongside** the old rows, not in place of them.

---

## Pre-flight

- [ ] `npm run gate:all` green locally on the branch being merged.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] Confirm `.env.local` `DATABASE_URL` endpoint == the deployed app's production endpoint
      (`vercel env pull --environment=production`). Never render or seed against a dev branch.
- [ ] Record a BEFORE snapshot — counts per `taskType`, and `AICostLedger` totals per feature.
      An empty ledger result means **zero calls billed**, not a broken query.

---

## A. Merge → migrations apply automatically

`npm run build` is `prisma generate && npm run gate:all && prisma migrate deploy && next build`,
so merging to `main` and deploying:

- runs the content gates **before** anything touches the database (a red bank blocks the deploy), then
- applies any pending migrations.

Pending as of this writing:

| Migration | What it does | Applied to prod? |
|---|---|---|
| `3_det_item_audio` | `DetItemAudio` table for pre-rendered TTS | ✅ applied |
| `4_read_and_complete` | adds `READ_AND_COMPLETE` to the `DetTaskType` enum | ❌ pending |
| `5_interactive_reading` | adds `INTERACTIVE_READING` to the `DetTaskType` enum | ❌ pending |
| `6_fill_in_the_blanks` | adds `FILL_IN_THE_BLANKS` to the `DetTaskType` enum | ❌ pending |
| `7_interactive_listening` | adds `INTERACTIVE_LISTENING` to the `DetTaskType` enum | ❌ pending |
| `8_writing_types` | adds `INTERACTIVE_WRITING` and `WRITING_SAMPLE` to the `DetTaskType` enum | ❌ pending |
| _(one enum migration per future task type — append as they land)_ | | |

**Verified against the live database 2026-08-16** (read-only probe, `.env.local` credentials):
`_prisma_migrations` holds `0_init`, `1_comp_pro`, `2_reviews`, `3_det_item_audio` and nothing
else. `DetTaskType` has exactly four labels — `READ_AND_SELECT`, `LISTEN_AND_TYPE`,
`WRITE_ABOUT_THE_PHOTO`, `SPEAK_ABOUT_THE_PHOTO`. `DetItem` holds 72 rows, 18 of each of those
four. `DetItemAudio` holds 18 rows, all with URLs. `AICostLedger` totals **$0.0152** across 3
rows, all `listen-and-type.tts`. There are **3 users and 14 attempts** — this is live data.

⚠️ **AUDIO CANNOT BE RENDERED BEFORE THE MIGRATE + SEED STEPS.**
`scripts/generate-det-audio.mts` derives its work list from `prisma.detItem.findMany` — it can
only render clips for items that EXIST IN A DATABASE. So the order is forced:

    migrate deploy  ->  seed the type  ->  audio:render  ->  live: true

and there is no way to pre-render audio for a type that has not been seeded. Since `.env.local`
points at the endpoint that serves production, running that chain locally IS the production
content deploy — it is not a separate, reversible step. Do it in the one careful session this
runbook describes, in the order below, or not at all.

`7_interactive_listening` adds **no audio table and no audio column**. `DetItemAudio`
(migration 3) already keys on `(itemId, seg)` with an integer `seg`, which is exactly what a
multi-clip conversation needs: the scenario clip takes seg 0 and turn *N* takes seg *N*.

⚠️ Postgres will not let a new enum value be **used** in the same transaction that adds it.
Migration and seeding are therefore separate steps — never combine them.

- [ ] Deploy, then confirm `prisma migrate status` reports no pending migrations.

---

## B. Read and Select — RETIRE AND REPLACE (not append)

Production holds the **OLD 18 gameable** Read and Select items: every one shares the mask
`RfRfRfRR`, so selecting slots 1, 3, 5, 7, 8 scores 100% without reading a word. The re-authored
18 have **different titles**, so a plain seed would leave 36 items with half of them gameable.

- [ ] Check `DetAttempt` foreign keys first: `SELECT count(*) FROM "DetAttempt" a JOIN "DetItem" i ON i.id=a."itemId" WHERE i."taskType"='READ_AND_SELECT';`
- [ ] If any attempts reference the old items → **`active = false`, do NOT delete.** Deleting
      cascades attempts and destroys a user's history.
- [ ] If zero attempts reference them, deactivating is still preferred over deleting.
- [ ] Seed the new set: `npm run seed:read-select` (skips if any rows exist — so deactivate
      first and use `seed:append`, or clear by title).
- [ ] Verify: `READ_AND_SELECT` with `active = true` == **18**, and all 18 titles are the new
      ones (`Everyday words —`, `General vocabulary —`, `Academic vocabulary —`).
- [ ] Verify the old 18 are present but `active = false` (history preserved, never served).

---

## C. Per-type seed steps

Run one per built type. Each seeder skips when rows already exist for that task type.

**Interactive Listening reads its content from a data file.** The reference conversation is
inline in `scripts/seed/interactive-listening.ts`; the authored scenarios come from
`scripts/seed/interactive-listening.data.mjs` (default-exports the array), mapped by
`interactive-listening.loader.ts`. When that file is absent the bank is the reference alone —
which is a legitimate state, so nothing errors.

- [ ] **`npm run seed:il-check` FIRST.** No database, no network. It prints whether the data file
      is present, how many scenarios parsed, the title/level/topic/blank/turn table, and the
      difficulty spread — and it EXITS NON-ZERO when the file is missing or the count is not the
      expected 11. Run it before migrating anything: seeding one item and seeding twelve look
      identical from the command's own output otherwise.

**Interactive Writing and Writing Sample read their content from data files too**, through the
same shared loader (`scripts/seed/_data-loader.ts`). The reference item of each type is inline;
`interactive-writing.data.mjs` and `writing-sample.data.mjs` carry the rest.

- [ ] **`npm run seed:writing-check` FIRST**, for the same reason — it prints both types' source,
      counts, per-item table and level/register/category spreads, and EXITS NON-ZERO if either
      file is missing or either count is not 11.

| Type | Command | Items | Status |
|---|---|---|---|
| Read and Select | `npm run seed:read-select` | 18 | ⚠️ retire-and-replace, see B |
| Read and Complete | `npm run seed:read-complete` | 18 | ❌ pending (built + live) |
| Listen and Type | `npm run seed:listen` | 18 | ✅ in prod |
| Write About the Photo | `npm run seed:write-photo` | 18 | ✅ in prod |
| Speak About the Photo | `npm run seed:speak` | 18 | ✅ in prod |
| Fill in the Blanks | `npm run seed:fill-blanks` | 18 | ❌ pending (built + live) |
| Interactive Reading | `npm run seed:interactive-reading` | 18 | ❌ pending (built + live) |
| Interactive Listening | `npm run seed:interactive-listening` | 12 | ❌ pending — **`live: false`** (also needs an audio render pass, §D) |
| Interactive Writing | `npm run seed:interactive-writing` | 12 | ❌ pending — **`live: false`**; no audio needed |
| Writing Sample | `npm run seed:writing-sample` | 12 | ❌ pending — **`live: false`**. Unscored in the real DET; graded here, and the composer says so |
| Speaking types | — | — | 🚫 BLOCKED — speaking inventory unresolved, see master doc §0b |
| _(append one row per new type as it lands)_ | | | |

---

## D. Audio render (any type with audio)

- [ ] `BLOB_READ_WRITE_TOKEN` present locally (it is NOT on the deployed app — reading a public
      Blob URL needs no credential; only the render writes).
- [ ] `npm run audio:render` — DRY RUN first: confirm unit count and projected cost.
- [ ] `npm run audio:render -- --db --limit=1` — smoke one clip, then fetch its Blob URL and
      confirm `200 audio/mpeg`.
- [ ] `npm run audio:render -- --db` — the rest.
- [ ] Re-run once more: it must report **0 units, $0.0000** (idempotency).

Done so far: 18/18 Listen and Type clips rendered, `$0.0152` total.

**Interactive Listening changes the shape of this step.** It is the first type with several
clips per item: **5 units each** (scenario + 4 heard turns; the opener is silent by design).

Measured over the full authored bank, 2026-08-16, from the same manifest the generator loops
over — no network, no database:

    12 conversations x 5 clips = 60 clips, 7,936 characters
    projected cost $0.1190  (tts-1 @ $15/1M chars)
    every item renders segs 0, 2, 3, 4, 5

Two things follow:

- The ledger now carries **one feature per task type** — `listen-and-type.tts` and
  `interactive-listening.tts` — so a per-feature reconciliation reads a number that is actually
  about the thing it names. The **$5 cap sums every feature**, so adding a task type cannot
  quietly unlock a second $5.
- `audioUrl` is **DB-only**. It is never authored in a seed and never stored in a payload; it is
  merged into the client payload at the render seam from the `DetItemAudio` row. Until the
  render runs, an Interactive Listening item projects `audioUrl: null` on every segment — which
  is the honest state, not a broken one.

- [ ] After rendering, confirm `DetItemAudio` holds **5 rows per Interactive Listening item**
      with segs `0, 2, 3, 4, 5` (seg 1 is the opener and is deliberately absent) — **60 rows
      across the 12 items**, on top of the 18 Listen and Type rows already there.

**The clips are released one stage at a time.** `toClientPayload()` returns Stage A only; each
turn's URL arrives from `POST /api/det/staged/advance` when that turn is reached. So an item whose
audio has not been rendered still runs — every segment projects `audioUrl: null` and the
composer says so rather than dead-ending — and a taker cannot read ahead to later clips.

⚠️ **"Listen once" is enforced for the honest path, not absolutely.** Blob audio is stored
`access: "public"`, so a URL that has already been released can be re-fetched by anyone reading
the network tab. Progressive delivery narrows that to the single turn currently in play; it does
not make replay impossible. Closing it fully needs short-lived signed URLs (private Blob) and is
not in this change.

---

## E. Verification — the numbers, not the vibes

- [ ] `npm run gate:runtime` — counts **`active: true`** rows against the Rule 7 floor. This is
      the half the build-time gates structurally cannot see (a deactivated row still exists in
      the seed source).
- [ ] Rule 7: **every skill ≥ 15 active items.** Reading is now carried by two task types, so a
      retire-and-replace mistake on one of them no longer zeroes the skill — but check anyway.
- [ ] Per-type counts in prod match the seed sources exactly (no doubling from an append).
- [ ] `AICostLedger` AFTER snapshot vs BEFORE: the audio pre-render's whole point is that
      `listen-and-type.tts` **stops accruing** as clips are replayed. Replay a rendered item a
      few times and confirm the user-triggered row count does not move. A code diff does not
      prove this; the count does.
- [ ] `/admin/accounts`: **Free + Pro + Comp == Total.** If it does not, the status predicates
      are not disjoint.
- [ ] Spot-check one item of each type end to end in the real app.

---

## F. Known hazards to re-read on the day

- **`pgbouncer=true` is missing** from the pooled `DATABASE_URL` (it carries `sslmode` and
  `channel_binding` only). Not breaking today; fix in the hardening pass before real traffic.
- **A preview deploy migrates production.** Do not push a branch with a destructive migration
  and assume it is sandboxed.
- **Do not delete DetItems.** Deactivate. Attempts cascade.
- **`live: false` types** are invisible to the practice hub and excluded from `MOCK_ORDER`
  (which is derived). Flipping `live: true` without seeding leaves the hub offering a task that
  dead-ends on an empty pool.
