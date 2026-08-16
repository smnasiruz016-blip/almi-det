// Pre-render every TTS audio unit once, upload to Vercel Blob, record the URL in
// DetItemAudio. Mirrors almi-toefl scripts/generate-toefl-audio.mts.
//
//   npx tsx --env-file=.env.local scripts/generate-det-audio.mts            # DRY RUN
//   npx tsx --env-file=.env.local scripts/generate-det-audio.mts --db       # render + upload
//   ... --limit=1     # smoke: first unit that has no audio yet
//   ... --force       # re-render units that already have a URL
//
// WHY: /api/det/audio/[attemptId] synthesizes on demand and returns
// `Cache-Control: private, no-store`, so no cache anywhere holds the result.
// Every user, every replay, every cold browser cache re-pays OpenAI for a
// byte-identical clip. The bank is fixed and fully derivable from seed content,
// so it can be rendered once for cents and served from the CDN thereafter.
//
// Idempotent: a unit with a non-empty audioUrl is skipped unless --force.
// Capped:     BUDGET_USD is checked before the run and again before every unit,
//             seeded from what AICostLedger already records for this feature — so
//             a repeated run cannot quietly spend the budget a second time.
// Metered:    one AICostLedger row per run (feature "listen-and-type.tts").
//
// DRY RUN is the default and makes NO network calls, NO Blob writes and NO DB
// writes. It prints exactly what a real run would render and what it would cost.

import { PrismaClient, type DetTaskType } from "@prisma/client";
import { putAudio, isBlobConfigured } from "../src/lib/storage/blob";
import { audioUnitsForItem, AUDIO_TASK_TYPES } from "../src/lib/det/audio-units";

const prisma = new PrismaClient();

// ── Pricing ──────────────────────────────────────────────────────────────────
// tts-1, NOT tts-1-hd. The serving path already uses tts-1 and pre-rendered
// audio must sound identical to what users hear today, so the model must not
// change here either.
export const TTS_MODEL = "tts-1";
const TTS_USD_PER_MCHAR = 15;
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const MAX_INPUT_CHARS = 4000; // OpenAI hard limit is 4096

/** 1 unit = 1/100 cent = $0.0001 — the same unit AICostLedger.costCents uses. */
export function ttsCostCents(chars: number): number {
  return Math.round((chars / 1_000_000) * TTS_USD_PER_MCHAR * 10_000);
}

const BUDGET_USD = 5;

// One ledger feature PER TASK TYPE, one shared cap across all of them.
//
// Interactive Listening renders several clips per item, so folding its spend
// into "listen-and-type.tts" would make the ledger say Listen and Type cost
// what a conversation cost — and the per-feature reconciliation the cost ledger
// exists for would be reading a number that is not about the thing it names.
// The CAP still sums every feature, so adding a task type cannot quietly unlock
// a second $5.
const FEATURE_BY_TYPE: Record<string, string> = {
  LISTEN_AND_TYPE: "listen-and-type.tts",
  INTERACTIVE_LISTENING: "interactive-listening.tts",
};
const ALL_FEATURES = [...new Set(Object.values(FEATURE_BY_TYPE))];
const featureOf = (taskType: string): string =>
  FEATURE_BY_TYPE[taskType] ?? `det-tts.${taskType.toLowerCase()}`;

// Matches the voice the on-demand path uses, so pre-rendered clips are
// indistinguishable from the fallback.
const DEFAULT_VOICE = "alloy";

// Pacing between OpenAI calls; the 429/5xx retry inside synthesizeMp3 applies on
// top. This just keeps the loop from tripping the rate limit in the first place.
const CALL_DELAY_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);
const DB = argv.includes("--db");
const FORCE = argv.includes("--force");
const LIMIT = (() => {
  const a = argv.find((x) => x.startsWith("--limit="));
  return a ? Number.parseInt(a.split("=")[1], 10) : Infinity;
})();

type Unit = {
  itemId: string;
  taskType: DetTaskType;
  title: string;
  seg: number;
  text: string;
  voice: string;
};

/**
 * Every audio unit in the bank.
 *
 * The DERIVATION lives in src/lib/det/audio-units.ts, not here, and that is
 * deliberate. This script needs a database; a content gate must not. With the
 * manifest inside this file, no gate could check that the segments an item's
 * payload REFERENCES are segments this script would actually render — a
 * conversation could ship naming a turn clip that never gets made, and the hole
 * would only appear in production. gate:il-audio-coverage now calls the same
 * function this loop does.
 *
 * Listen and Type speaks `audioScript ?? sentence` — the same fallback the audio
 * route applies, so a pre-rendered clip and an on-demand one are the same audio.
 * Interactive Listening contributes the scenario clip at seg 0 and one clip per
 * non-opener turn at seg N.
 *
 * VOICE. Both speakers in a conversation currently get DEFAULT_VOICE. Only the
 * other speaker is ever heard — the taker's own replies are read, not played —
 * so one voice per item is correct today. It stops being correct the moment a
 * scenario has two audible speakers.
 */
async function collectUnits(): Promise<Unit[]> {
  const units: Unit[] = [];

  const items = await prisma.detItem.findMany({
    where: { taskType: { in: [...AUDIO_TASK_TYPES] }, active: true },
    orderBy: { id: "asc" },
  });

  for (const it of items) {
    for (const u of audioUnitsForItem(it.taskType, it.payload)) {
      units.push({
        itemId: it.id,
        taskType: it.taskType,
        title: it.title,
        seg: u.seg,
        text: u.text,
        voice: DEFAULT_VOICE,
      });
    }
  }

  return units;
}

async function spentUsd(features: string[]): Promise<number> {
  const agg = await prisma.aICostLedger.aggregate({
    where: { feature: { in: features } },
    _sum: { costCents: true },
  });
  // A null sum means NO ROWS — i.e. zero spent. It does not mean the query
  // failed. Treating an empty result as "unknown" here would either block a
  // legitimate first run or, worse, invite someone to skip the cap.
  return (agg._sum.costCents ?? 0) / 10_000;
}

async function synthesizeMp3(text: string, voice: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 20) throw new Error("OPENAI_API_KEY missing or invalid");
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: text.slice(0, MAX_INPUT_CHARS),
        voice,
        response_format: "mp3",
        speed: 1.0,
      }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    lastErr = `${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) break;
    await sleep(attempt * 600);
  }
  throw new Error(`OpenAI TTS failed (${lastErr})`);
}

/** Duration by scanning MPEG audio frame headers. Returns 0 rather than a guess
 *  if the stream cannot be parsed, so durationSec is never fabricated. */
function mp3DurationSec(buf: Buffer): number {
  const V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const RATES: Record<number, number[]> = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000],
  };
  let i = 0,
    seconds = 0,
    frames = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const verId = (buf[i + 1] >> 3) & 0x03;
    const layer = (buf[i + 1] >> 1) & 0x03;
    if (layer !== 0x01) { i++; continue; } // Layer III only
    const brIdx = (buf[i + 2] >> 4) & 0x0f;
    const srIdx = (buf[i + 2] >> 2) & 0x03;
    const pad = (buf[i + 2] >> 1) & 0x01;
    const rates = RATES[verId];
    if (!rates || srIdx === 3 || brIdx === 0 || brIdx === 15) { i++; continue; }
    const sampleRate = rates[srIdx];
    const kbps = (verId === 3 ? V1_L3 : V2_L3)[brIdx];
    if (!kbps || !sampleRate) { i++; continue; }
    const samples = verId === 3 ? 1152 : 576;
    const frameLen = Math.floor((samples / 8) * ((kbps * 1000) / sampleRate)) + pad;
    if (frameLen <= 4) { i++; continue; }
    seconds += samples / sampleRate;
    frames++;
    i += frameLen;
  }
  return frames > 0 ? Math.round(seconds) : 0;
}

/** Deterministic, no random suffix — re-rendering replaces in place and the URL
 *  for a given unit never changes. */
function blobKey(u: Unit): string {
  return u.seg === 0
    ? `det/audio/${u.taskType}/${u.itemId}.mp3`
    : `det/audio/${u.taskType}/${u.itemId}/${u.seg}.mp3`;
}

async function main() {
  const units = await collectUnits();

  // No catch on purpose: migration 3_det_item_audio is applied, so a read failure
  // is a real database problem and must surface rather than be swallowed into
  // "nothing rendered yet" — which would silently re-render and re-charge for the
  // whole bank.
  const existing = await prisma.detItemAudio.findMany();
  const have = new Map(
    existing.filter((r) => r.audioUrl).map((r) => [`${r.itemId}/${r.seg}`, r.audioUrl]),
  );

  const pending = units.filter((u) => FORCE || !have.has(`${u.itemId}/${u.seg}`));
  const todo = pending.slice(0, LIMIT === Infinity ? pending.length : LIMIT);

  const chars = todo.reduce((n, u) => n + u.text.length, 0);
  const projectedCents = todo.reduce((n, u) => n + ttsCostCents(u.text.length), 0);
  const already = await spentUsd(ALL_FEATURES);

  console.log(`Pre-render TTS → Vercel Blob   (${DB ? "LIVE" : "DRY RUN — no network, no Blob, no DB writes"})\n`);
  console.log(`  model                 ${TTS_MODEL} @ $${TTS_USD_PER_MCHAR}/1M chars`);
  console.log(`  blob configured       ${isBlobConfigured() ? "yes" : "NO — a live run would refuse"}`);
  console.log(`  audio units in bank   ${units.length}`);
  console.log(`  already rendered      ${have.size}${FORCE ? "  (--force: re-rendering anyway)" : ""}`);
  console.log(
    `  to render this run    ${todo.length}${LIMIT === Infinity ? "" : `  (--limit=${LIMIT} of ${pending.length} pending)`}`,
  );
  console.log(`  characters            ${chars.toLocaleString("en-US")}`);
  console.log(`  projected cost        $${(projectedCents / 10_000).toFixed(4)}`);
  console.log(`  already spent (${ALL_FEATURES.join(" + ")})  $${already.toFixed(4)}`);
  console.log(`  budget cap            $${BUDGET_USD.toFixed(2)}\n`);

  const byType = new Map<string, { n: number; chars: number }>();
  for (const u of todo) {
    const e = byType.get(u.taskType) ?? { n: 0, chars: 0 };
    e.n++; e.chars += u.text.length;
    byType.set(u.taskType, e);
  }
  for (const [t, v] of [...byType].sort()) {
    console.log(
      `   ${t.padEnd(22)} ${String(v.n).padStart(4)} units  ${String(v.chars).padStart(6)} chars  $${(ttsCostCents(v.chars) / 10_000).toFixed(4)}`,
    );
  }

  if (already + projectedCents / 10_000 > BUDGET_USD) {
    console.error(
      `\nBUDGET CAP $${BUDGET_USD} would be exceeded ($${already.toFixed(4)} spent + $${(projectedCents / 10_000).toFixed(4)} projected) — refusing.`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!DB) {
    console.log(`\n  sample blob paths:`);
    for (const u of todo.slice(0, 3)) {
      console.log(`     ${blobKey(u)}   voice=${u.voice}  ${u.text.length} chars`);
    }
    console.log(`\nDRY RUN — nothing was rendered, uploaded or written. Pass --db to execute.`);
    await prisma.$disconnect();
    return;
  }

  if (!isBlobConfigured()) {
    console.error("BLOB_READ_WRITE_TOKEN missing — refusing to render audio that cannot be stored.");
    await prisma.$disconnect();
    process.exit(1);
  }

  let spentCents = 0;
  let done = 0;
  // Per-feature tally, so the ledger row for each task type carries that task
  // type's spend rather than the run's total.
  const perFeature = new Map<string, { cents: number; calls: number }>();

  for (const [n, u] of todo.entries()) {
    if (n > 0) await sleep(CALL_DELAY_MS);
    if (already + spentCents / 10_000 > BUDGET_USD) {
      console.error(`BUDGET CAP $${BUDGET_USD} reached mid-run — stopping after ${done} unit(s).`);
      break;
    }
    process.stdout.write(`  ${u.taskType}/${u.itemId} (${u.title.slice(0, 28)}) ${u.text.length}c… `);

    const mp3 = await synthesizeMp3(u.text, u.voice);
    const unitCents = ttsCostCents(u.text.length);
    spentCents += unitCents;
    const f = featureOf(u.taskType);
    const tally = perFeature.get(f) ?? { cents: 0, calls: 0 };
    tally.cents += unitCents;
    tally.calls += 1;
    perFeature.set(f, tally);

    const stored = await putAudio(blobKey(u), mp3);
    const durationSec = mp3DurationSec(mp3);

    await prisma.detItemAudio.upsert({
      where: { itemId_seg: { itemId: u.itemId, seg: u.seg } },
      create: {
        itemId: u.itemId,
        seg: u.seg,
        audioUrl: stored.url,
        durationSec,
        chars: u.text.length,
        voice: u.voice,
      },
      update: { audioUrl: stored.url, durationSec, chars: u.text.length, voice: u.voice },
    });
    done++;
    console.log(`✓ ${(mp3.length / 1024).toFixed(0)}KB ${durationSec}s`);
  }

  // One ledger row per FEATURE per run, so a run is reconcilable against the cap
  // and each task type's line in the ledger is about that task type.
  for (const [feature, tally] of perFeature) {
    if (tally.cents <= 0) continue;
    await prisma.aICostLedger.create({
      data: {
        userId: null,
        feature,
        model: TTS_MODEL,
        inputTokens: tally.calls,
        outputTokens: 0,
        costCents: tally.cents,
        success: true,
      },
    });
  }

  console.log(
    `\nDONE — ${done} unit(s). Cost this run: $${(spentCents / 10_000).toFixed(4)}. ` +
      `Total across ${ALL_FEATURES.join(" + ")}: $${(await spentUsd(ALL_FEATURES)).toFixed(4)}`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
