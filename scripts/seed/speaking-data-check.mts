// npm run seed:speaking-check — what Speaking content exists, and is it ready?
//
// NO DATABASE, NO NETWORK, and — because this is the skill that costs money —
// NO TRANSCRIPTION EITHER. It reads the seed source through the same path the
// content gates use and prints what would be written.
//
// Same silent-no-op guard as seed:il-check and seed:writing-check: exits
// non-zero when a data file is missing or the count is wrong, because seeding
// zero items and seeding eighteen produce identical output everywhere else.

process.env.DATABASE_URL ??= "postgresql://check:check@localhost:5432/check";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;

const EXPECTED_READ_ALOUD = 18;

async function main(): Promise<void> {
  let ITEMS: { title: string; difficulty: string; payload: { text?: string } }[];
  let SOURCE: { dataFilePresent: boolean; dataFile: string; itemCount: number; note: string | null };

  try {
    const mod = await import("./read-aloud");
    ITEMS = mod.ITEMS as unknown as typeof ITEMS;
    SOURCE = mod.READ_ALOUD_SOURCE;
  } catch (e) {
    console.error(`\n✗ The Read Aloud seed module could not be loaded.\n`);
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const { SPEAKING_DAILY_CAP } = await import("../../src/lib/det/speaking");
  const { SPEAKING_TASKS } = await import("../../src/lib/det/speaking-tasks");

  console.log(`\nSpeaking — content source\n`);
  console.log(`  data file           ${SOURCE.dataFile}`);
  console.log(`  present             ${SOURCE.dataFilePresent ? "YES" : `NO  (${SOURCE.note})`}`);
  console.log(`  Read Aloud items    ${SOURCE.itemCount}`);

  console.log(`\n  ${"title".padEnd(30)} ${"level".padEnd(11)} chars words`);
  console.log(`  ${"-".repeat(30)} ${"-".repeat(11)} ----- -----`);
  for (const it of ITEMS) {
    const t = it.payload.text ?? "";
    console.log(
      `  ${it.title.slice(0, 30).padEnd(30)} ${it.difficulty.padEnd(11)} ${String(t.length).padStart(5)} ${String(
        t.trim().split(/\s+/).length,
      ).padStart(5)}`,
    );
  }

  const byDiff = new Map<string, number>();
  for (const it of ITEMS) byDiff.set(it.difficulty, (byDiff.get(it.difficulty) ?? 0) + 1);
  console.log(
    `\n  difficulty spread   ${[...byDiff].sort().map(([d, n]) => `${d}=${n}`).join("  ") || "none"}`,
  );

  console.log(`\nSpeaking cost controls\n`);
  console.log(`  daily cap / user    ${SPEAKING_DAILY_CAP} attempts, all speaking types`);
  for (const [t, task] of Object.entries(SPEAKING_TASKS)) {
    console.log(
      `  ${t.padEnd(24)} ledger "${task!.transcribeFeature}"  max ${task!.recordSeconds}s per recording`,
    );
  }

  if (!SOURCE.dataFilePresent) {
    console.log(`\n⚠ NOT READY. ${SOURCE.dataFile} is not present.\n`);
    process.exit(1);
  }
  if (SOURCE.itemCount !== EXPECTED_READ_ALOUD) {
    console.log(
      `\n⚠ COUNT MISMATCH: ${SOURCE.itemCount} Read Aloud item(s) loaded, expected ${EXPECTED_READ_ALOUD}.\n`,
    );
    process.exit(1);
  }

  console.log(
    `\n✓ ${SOURCE.itemCount} Read Aloud items ready. Every item parsed with the runtime schema.\n` +
      `  No transcription was performed by this check.\n`,
  );
}

main().catch((e) => {
  console.error("\n✗ speaking-data-check failed:", e);
  process.exit(1);
});
