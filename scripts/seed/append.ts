// Append-safe seeder. Inserts ONLY items not already in the database, so it is
// safe to run against a populated production DB and is fully idempotent —
// re-running inserts nothing new.
//
// DetItem has no natural unique key (id is a cuid), so createMany({ skipDuplicates })
// can't dedupe by content. We dedupe on (taskType + title), which is unique per
// item across all four seed sets, and insert only the missing rows.
//
//   npm run seed:append          insert missing items
//   npm run seed:append -- --dry preview only, write nothing
//
// Source of truth is the four task seed files — we import their ITEMS arrays so
// there is never a second copy of the content to drift out of sync.

import { PrismaClient } from "@prisma/client";
import { ITEMS as READ_AND_SELECT } from "./read-and-select";
import { ITEMS as READ_AND_COMPLETE } from "./read-and-complete";
import { ITEMS as INTERACTIVE_READING } from "./interactive-reading";
import { ITEMS as FILL_IN_THE_BLANKS } from "./fill-in-the-blanks";
import { ITEMS as LISTEN_AND_TYPE } from "./listen-and-type";
import { ITEMS as INTERACTIVE_LISTENING } from "./interactive-listening";
import { ITEMS as WRITE_ABOUT_THE_PHOTO } from "./write-about-photo";
import { ITEMS as INTERACTIVE_WRITING } from "./interactive-writing";
import { ITEMS as WRITING_SAMPLE } from "./writing-sample";
import { ITEMS as SPEAK_ABOUT_THE_PHOTO } from "./speak-about-photo";
import { ITEMS as READ_ALOUD } from "./read-aloud";
import { ITEMS as READ_THEN_SPEAK } from "./read-then-speak";
import { ITEMS as LISTEN_THEN_SPEAK } from "./listen-then-speak";
import { ITEMS as SPEAKING_SAMPLE } from "./speaking-sample";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

const ALL = [
  ...READ_AND_SELECT,
  ...READ_AND_COMPLETE,
  ...INTERACTIVE_READING,
  ...FILL_IN_THE_BLANKS,
  ...LISTEN_AND_TYPE,
  ...INTERACTIVE_LISTENING,
  ...WRITE_ABOUT_THE_PHOTO,
  ...INTERACTIVE_WRITING,
  ...WRITING_SAMPLE,
  ...SPEAK_ABOUT_THE_PHOTO,
  ...READ_ALOUD,
  ...READ_THEN_SPEAK,
  ...LISTEN_THEN_SPEAK,
  ...SPEAKING_SAMPLE,
];

const key = (taskType: string, title: string) => `${taskType}::${title}`;

async function main() {
  // Guard against an accidental duplicate (taskType,title) inside our own source.
  const sourceKeys = ALL.map((it) => key(it.taskType as string, it.title));
  const dupes = sourceKeys.filter((k, i) => sourceKeys.indexOf(k) !== i);
  if (dupes.length > 0) {
    throw new Error(`Duplicate (taskType,title) in seed source: ${[...new Set(dupes)].join(", ")}`);
  }

  const existing = await prisma.detItem.findMany({
    select: { taskType: true, title: true },
  });
  const seen = new Set(existing.map((e) => key(e.taskType, e.title)));

  const toInsert = ALL.filter((it) => !seen.has(key(it.taskType as string, it.title)));

  // Per-task summary so it's clear what will change.
  const byTask = (rows: { taskType: string }[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.taskType] = (acc[r.taskType] ?? 0) + 1;
      return acc;
    }, {});

  console.log(`Source items: ${ALL.length} | already in DB: ${existing.length} | to insert: ${toInsert.length}`);
  const summary = byTask(toInsert as { taskType: string }[]);
  for (const t of Object.keys(summary).sort()) {
    console.log(`  + ${t}: ${summary[t]}`);
  }

  if (toInsert.length === 0) {
    console.log("Nothing to insert — database already has every source item.");
    return;
  }

  if (DRY) {
    console.log("\n--dry: no rows written. Re-run without --dry to insert.");
    return;
  }

  const res = await prisma.detItem.createMany({ data: toInsert });
  console.log(`\nInserted ${res.count} new item(s). Skipped ${ALL.length - toInsert.length} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
