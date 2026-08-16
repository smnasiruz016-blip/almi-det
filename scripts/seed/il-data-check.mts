// npm run seed:il-check — what Interactive Listening content actually exists,
// and would it survive the gates?
//
// NO DATABASE, NO NETWORK. This reads the seed source through the same path the
// content gates use, so it answers the question that matters before anyone
// migrates or seeds anything: is the authored data present, does every scenario
// parse, and how many items would be written.
//
// It exists because "the loader found no data file" and "the loader found the
// data file and mapped 11 scenarios" produce the same silent success otherwise —
// and a run that reports green on a bank of one is the exact shape of failure
// this repo keeps re-learning.

process.env.DATABASE_URL ??= "postgresql://check:check@localhost:5432/check";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;

const EXPECTED_SCENARIOS = 11; // Cowork's brief: 11 + the reference = 12

async function main(): Promise<void> {
  let ITEMS: { title: string; difficulty: string; topicTag: string; payload: unknown }[];
  let IL_SOURCE: {
    dataFilePresent: boolean;
    dataFile: string;
    itemCount: number;
    note: string | null;
    referenceCount: number;
    totalCount: number;
  };

  try {
    const mod = await import("./interactive-listening");
    ITEMS = mod.ITEMS as unknown as typeof ITEMS;
    IL_SOURCE = mod.IL_SOURCE;
  } catch (e) {
    console.error(`\n✗ The seed module could not be loaded.\n`);
    console.error(e instanceof Error ? e.message : String(e));
    console.error(
      `\n  A data file that EXISTS but is malformed fails here rather than being skipped.\n`,
    );
    process.exit(1);
  }

  console.log(`\nInteractive Listening — content source\n`);
  console.log(`  data file           ${IL_SOURCE.dataFile}`);
  console.log(
    `  present             ${IL_SOURCE.dataFilePresent ? "YES" : `NO  (${IL_SOURCE.note})`}`,
  );
  console.log(`  scenarios loaded    ${IL_SOURCE.itemCount}`);
  console.log(`  reference (inline)  ${IL_SOURCE.referenceCount}`);
  console.log(`  ITEMS total         ${IL_SOURCE.totalCount}`);

  const { interactiveListeningPayloadSchema, completeBlanks } = await import(
    "../../src/lib/det/tasks/interactive-listening"
  );

  console.log(`\n  ${"title".padEnd(46)} ${"level".padEnd(11)} ${"topic".padEnd(14)} blanks turns`);
  console.log(`  ${"-".repeat(46)} ${"-".repeat(11)} ${"-".repeat(14)} ------ -----`);
  for (const it of ITEMS) {
    const p = interactiveListeningPayloadSchema.parse(it.payload);
    console.log(
      `  ${it.title.slice(0, 46).padEnd(46)} ${it.difficulty.padEnd(11)} ${it.topicTag
        .slice(0, 14)
        .padEnd(14)} ${String(completeBlanks(p.complete.text).length).padStart(6)} ${String(
        p.turns.length,
      ).padStart(5)}`,
    );
  }

  const byDiff = new Map<string, number>();
  for (const it of ITEMS) byDiff.set(it.difficulty, (byDiff.get(it.difficulty) ?? 0) + 1);
  console.log(
    `\n  difficulty spread   ${[...byDiff].sort().map(([d, n]) => `${d}=${n}`).join("  ") || "none"}`,
  );

  if (!IL_SOURCE.dataFilePresent) {
    console.log(
      `\n⚠ NOT READY. ${IL_SOURCE.dataFile} is not present, so the bank is the reference\n` +
        `  conversation alone. Drop the authored scenarios in and re-run this.\n` +
        `  Expected: ${EXPECTED_SCENARIOS} scenarios + 1 reference = ${EXPECTED_SCENARIOS + 1} items.\n`,
    );
    process.exit(1);
  }

  if (IL_SOURCE.itemCount !== EXPECTED_SCENARIOS) {
    console.log(
      `\n⚠ COUNT MISMATCH: ${IL_SOURCE.itemCount} scenario(s) loaded, expected ${EXPECTED_SCENARIOS}.\n` +
        `  Not fatal on its own — but check nothing was dropped before seeding.\n`,
    );
    process.exit(1);
  }

  console.log(
    `\n✓ ${IL_SOURCE.totalCount} items ready. Every scenario parsed with the runtime schema.\n` +
      `  Next: npm run gate:all, then the migrate + seed steps in docs/DEPLOY-RUNBOOK.md.\n`,
  );
}

main().catch((e) => {
  console.error("\n✗ il-data-check failed:", e);
  process.exit(1);
});
