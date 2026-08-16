// npm run seed:writing-check — what Interactive Writing and Writing Sample
// content actually exists, and would it survive the gates?
//
// NO DATABASE, NO NETWORK. Reads the seed source through the same path the
// content gates use, so it answers the question that matters before anyone
// migrates or seeds anything: are both data files present, does every item parse
// with the runtime schema, and how many items would be written.
//
// The same silent-no-op guard as seed:il-check, and it exists for the same
// reason: seeding one item and seeding twelve produce identical output from
// every other command, so a run can report green on a bank of one.

process.env.DATABASE_URL ??= "postgresql://check:check@localhost:5432/check";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;

const EXPECTED_AUTHORED = 11; // Cowork's brief: 11 + 1 reference = 12 per type

type Source = {
  dataFilePresent: boolean;
  dataFile: string;
  itemCount: number;
  note: string | null;
  referenceCount: number;
  totalCount: number;
};

type Row = { title: string; difficulty: string; topicTag: string; payload: Record<string, unknown> };

async function main(): Promise<void> {
  let iw: { ITEMS: Row[]; SOURCE: Source };
  let ws: { ITEMS: Row[]; SOURCE: Source };

  try {
    const iwMod = await import("./interactive-writing");
    const wsMod = await import("./writing-sample");
    iw = { ITEMS: iwMod.ITEMS as unknown as Row[], SOURCE: iwMod.IW_SOURCE };
    ws = { ITEMS: wsMod.ITEMS as unknown as Row[], SOURCE: wsMod.WS_SOURCE };
  } catch (e) {
    console.error(`\n✗ A Writing seed module could not be loaded.\n`);
    console.error(e instanceof Error ? e.message : String(e));
    console.error(`\n  A data file that EXISTS but is malformed fails here rather than being skipped.\n`);
    process.exit(1);
  }

  const { interactiveWritingPayloadSchema } = await import(
    "../../src/lib/det/tasks/interactive-writing"
  );
  const { writingSamplePayloadSchema } = await import("../../src/lib/det/tasks/writing-sample");

  let bad = 0;

  const header = (label: string, src: Source): void => {
    console.log(`\n${label} — content source\n`);
    console.log(`  data file           ${src.dataFile}`);
    console.log(`  present             ${src.dataFilePresent ? "YES" : `NO  (${src.note})`}`);
    console.log(`  authored loaded     ${src.itemCount}`);
    console.log(`  reference (inline)  ${src.referenceCount}`);
    console.log(`  ITEMS total         ${src.totalCount}`);
    if (!src.dataFilePresent) {
      console.log(`  ⚠ NOT READY — expected ${EXPECTED_AUTHORED} authored + 1 reference.`);
      bad++;
    } else if (src.itemCount !== EXPECTED_AUTHORED) {
      console.log(`  ⚠ COUNT MISMATCH — ${src.itemCount} loaded, expected ${EXPECTED_AUTHORED}.`);
      bad++;
    }
  };

  const spread = (rows: Row[], key: (r: Row) => string, label: string): void => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    console.log(
      `  ${label.padEnd(20)}${[...m].sort().map(([k, v]) => `${k}=${v}`).join("  ") || "none"}`,
    );
  };

  // ------------------------------------------------ INTERACTIVE_WRITING ----
  header("Interactive Writing", iw.SOURCE);
  console.log(`\n  ${"title".padEnd(44)} ${"level".padEnd(11)} ${"register".padEnd(9)} p1  p2`);
  console.log(`  ${"-".repeat(44)} ${"-".repeat(11)} ${"-".repeat(9)} --- ---`);
  for (const it of iw.ITEMS) {
    const p = interactiveWritingPayloadSchema.parse(it.payload);
    console.log(
      `  ${it.title.slice(0, 44).padEnd(44)} ${it.difficulty.padEnd(11)} ${p.register.padEnd(9)} ` +
        `${String(p.part1.prompt.length).padStart(3)} ${String(p.part2.prompt.length).padStart(3)}`,
    );
  }
  console.log("");
  spread(iw.ITEMS, (r) => r.difficulty, "difficulty");
  spread(iw.ITEMS, (r) => String(interactiveWritingPayloadSchema.parse(r.payload).register), "register");
  spread(iw.ITEMS, (r) => r.topicTag, "topicTag");

  // ---------------------------------------------------- WRITING_SAMPLE ----
  header("Writing Sample", ws.SOURCE);
  console.log(`\n  ${"title".padEnd(44)} ${"level".padEnd(11)} ${"category".padEnd(9)} chars`);
  console.log(`  ${"-".repeat(44)} ${"-".repeat(11)} ${"-".repeat(9)} -----`);
  for (const it of ws.ITEMS) {
    const p = writingSamplePayloadSchema.parse(it.payload);
    console.log(
      `  ${it.title.slice(0, 44).padEnd(44)} ${it.difficulty.padEnd(11)} ${p.category.padEnd(9)} ` +
        `${String(p.prompt.length).padStart(5)}`,
    );
  }
  console.log("");
  spread(ws.ITEMS, (r) => r.difficulty, "difficulty");
  spread(ws.ITEMS, (r) => String(writingSamplePayloadSchema.parse(r.payload).category), "category");
  spread(ws.ITEMS, (r) => r.topicTag, "topicTag");

  if (bad > 0) {
    console.log(`\n✗ ${bad} Writing type(s) not ready. Drop the missing data in and re-run.\n`);
    process.exit(1);
  }

  console.log(
    `\n✓ ${iw.SOURCE.totalCount} Interactive Writing + ${ws.SOURCE.totalCount} Writing Sample items ready.\n` +
      `  Every item parsed with the runtime schema.\n` +
      `  Next: npm run gate:all, then the migrate + seed steps in docs/DEPLOY-RUNBOOK.md.\n`,
  );
}

main().catch((e) => {
  console.error("\n✗ writing-data-check failed:", e);
  process.exit(1);
});
