// RR-401 · puts the factory pack's READY items (src/content/factory/det-model-answers.json) into the DetItem table, keyed by
// (taskType, title) like scripts/seed/append.ts. Run by the OWNER. Dry run by default; it writes only with BOTH --confirm AND
// FACTORY_WRITE=yes.
//   - an item already there and equal: left alone (re-running changes nothing)
//   - an item already there but different: listed, NOT changed (a corrected pack needs the owner's word)
//   - the same prompt already live under another title: skipped (no duplicate task)
//   - image-pending and audio-pending items are never rows, so they are never written
//   - nothing is ever deleted or deactivated; no migration, no schema change
// The owner sets DATABASE_URL for the process himself.
// Run: npx tsx scripts/factory/seed-det-pack.ts                                   (dry run)
//      $env:FACTORY_WRITE="yes"; npx tsx scripts/factory/seed-det-pack.ts --confirm
import { PrismaClient, type DetTaskType, type Prisma } from "@prisma/client";
import { runSeed, writeAllowed, type SeedRow } from "../../src/lib/factory/seed-rows";
import { ITEMS, FACTORY_DATA } from "../seed/factory-pack1";

const write = writeAllowed(process.argv, process.env);
const prisma = new PrismaClient();
const rows = ITEMS as unknown as SeedRow[];

async function main() {
  const pending = FACTORY_DATA.items.filter((i) => i.status !== "ready");
  const { plan, written } = await runSeed(
    {
      findMany: (types) =>
        prisma.detItem.findMany({
          where: { taskType: { in: types as DetTaskType[] } },
          select: { taskType: true, title: true, prompt: true, difficulty: true, topicTag: true, guidanceNote: true, payload: true },
        }),
      createMany: async (create) => (await prisma.detItem.createMany({ data: create.map((r) => ({ ...r, payload: r.payload as Prisma.InputJsonValue })) })).count,
    },
    rows,
    write,
  );
  console.log(`factory items ${FACTORY_DATA.items.length} · ready ${rows.length} · pending (never written) ${pending.length}`);
  console.log(`create ${plan.create.length} · already there and equal ${plan.same.length} · there but different (NOT changed) ${plan.differs.length} · duplicate prompt under another title (skipped) ${plan.duplicate.length}`);
  for (const c of plan.create) console.log(`  CREATE ${c.taskType} "${c.title}"`);
  for (const d of plan.differs) console.log(`  DIFFERS ${d}`);
  for (const d of plan.duplicate) console.log(`  DUPLICATE ${d}`);
  for (const p of pending) console.log(`  PENDING ${p.key} "${p.title}": ${p.status}`);
  if (!write) { console.log("DRY RUN: nothing written. To write: set FACTORY_WRITE=yes and add --confirm."); return; }
  const back = await prisma.detItem.findMany({ where: { OR: rows.map((r) => ({ taskType: r.taskType as DetTaskType, title: r.title })) }, select: { title: true, active: true } });
  console.log(`WRITTEN ${written}. Read back: ${back.length} of ${rows.length} factory items present, ${back.filter((b) => b.active).length} active.`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
