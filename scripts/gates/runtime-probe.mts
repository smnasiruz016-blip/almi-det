// gate:runtime — the half the build-time gates structurally cannot see.
//
// The build gate counts AUTHORED items (scripts/seed/*.ts). DetItem.active
// defaults true and no seed sets it false, so the two agree today. They stop
// agreeing the moment a row is deactivated in the database: the authored count
// still says 18, the serving pool is smaller, and Rule 7 can be breached in
// production while every build stays green.
//
// This probe counts what actually SERVES — active rows, grouped the same way —
// and applies the same hard floor. It needs a real DATABASE_URL, so it is NOT
// part of `build` (previews have no database of their own). Run it against
// production after a deploy, or on a schedule.
//
//   npm run gate:runtime

import { loadBank, SKILLS, type Skill } from "./_bank.mjs";

const SKILL_FLOOR = 15;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("gate:gate@localhost")) {
    console.error(
      "\n✗ gate:runtime needs a real DATABASE_URL.\n" +
        "  This probe is deliberately excluded from `build` — it checks the serving\n" +
        "  database, not the source. Run it against production after deploying.\n",
    );
    process.exit(1);
  }

  const { DET_TASKS } = await import("../../src/lib/det/registry");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.detItem.groupBy({
      by: ["taskType", "difficulty", "active"],
      _count: { _all: true },
    });

    const bank = await loadBank();
    const authored = bank.items.length;

    const bySkill = new Map<Skill, number>();
    const inactive: string[] = [];
    let activeTotal = 0;

    for (const r of rows) {
      const def = (DET_TASKS as Record<string, { skill: Skill } | undefined>)[r.taskType];
      const n = r._count._all;
      if (!r.active) {
        inactive.push(`${r.taskType} / ${r.difficulty}: ${n} deactivated`);
        continue;
      }
      activeTotal += n;
      if (!def) continue;
      bySkill.set(def.skill, (bySkill.get(def.skill) ?? 0) + n);
    }

    console.log("\n─── gate:runtime (serving database) ─────────────────");
    console.log(`  authored in source : ${authored}`);
    console.log(`  active in database : ${activeTotal}`);
    console.log(`  deactivated rows   : ${inactive.length ? inactive.join("; ") : "none"}`);
    console.log("");

    let fails = 0;
    for (const s of SKILLS) {
      const n = bySkill.get(s) ?? 0;
      const ok = n >= SKILL_FLOOR;
      if (!ok) fails++;
      console.log(`  ${ok ? "✓" : "✗"} ${s.padEnd(10)} ${String(n).padStart(3)} / ${SKILL_FLOOR} active`);
    }

    if (activeTotal !== authored) {
      console.log(
        `\n  ⚠ DRIFT: ${authored} authored vs ${activeTotal} active. ` +
          `Either seeds were never applied, or rows were deactivated/removed in the database.`,
      );
    }

    console.log(
      fails > 0
        ? `\n✗ gate:runtime: FAIL — ${fails} skill(s) below the floor IN PRODUCTION.\n`
        : `\n✓ gate:runtime: PASS\n`,
    );
    process.exit(fails > 0 ? 1 : 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("✗ gate:runtime ERRORED —", e);
  process.exit(1);
});
