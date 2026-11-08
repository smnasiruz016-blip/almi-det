// RR-401 · proofs for the AlmiDET content factory: the importer (parsing, idempotence, stable ids), the grammar gate, the 85-level notes
// check, the word-count gate, the pending (image/audio) rule and the seed (dry run writes nothing; the write is idempotent).
// Offline and free: LanguageTool's answers are fixtures here, and the database is a fake.
//   npx tsx scripts/factory/factory.test.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePack, countWords, type Pack } from "../../src/lib/factory/pack";
import { importPacks, mergeData, type Lt, type ModelData } from "../../src/lib/factory/import";
import type { LtMatch } from "../../src/lib/factory/grammar-gate";
import { planSeed, runSeed, seedRowFor, seedRows, writeAllowed, type LiveRow, type SeedRow } from "../../src/lib/factory/seed-rows";
import { existingBank } from "./existing-bank";
import { DEFAULTS, ITEMS as FACTORY_ITEMS } from "../seed/factory-pack1";
import { modelAnswersFor } from "../../src/lib/factory/model-answers";

let passed = 0, failed = 0;
const t = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; process.exitCode = 1; console.log(`  FAIL  ${name}\n        ${String((e as Error).message).split("\n")[0]}`); }
};

const FILE = "AlmiDET_Pack1.md";
const SRC = readFileSync(join(process.cwd(), "scripts", "factory", "fixtures", FILE), "utf8").replace(/\r\n/g, "\n");
const load = (md = SRC) => parsePack(md, FILE);
const clean: Lt = () => [];
/** LanguageTool fixture: flags `word` (as a spelling error) wherever it appears in a checked text */
const flag = (word: string, category = "TYPOS", issueType = "misspelling"): Lt => (text) => {
  const i = text.indexOf(word); if (i < 0) return [];
  const m: LtMatch = { offset: i, length: word.length, message: "Possible spelling mistake", replacements: [{ value: "x" }], rule: { id: "MORFOLOGIK_RULE_EN_US", issueType, category: { id: category } } };
  return [m];
};
const existing = await existingBank();
const COMMITTED: ModelData = JSON.parse(readFileSync(join(process.cwd(), "src", "content", "factory", "det-model-answers.json"), "utf8"));

console.log("importer");
const pack: Pack = load();
await t("parses the pack: 12 items (3 photo, 2 interactive writing, 2 writing sample, 2 conversation, 3 speaking), front matter read", () => {
  const kinds = pack.items.map((i) => i.kind);
  const n = (k: string) => kinds.filter((x) => x === k).length;
  assert.deepEqual([n("PHOTO"), n("INTERACTIVE_WRITING"), n("WRITING_SAMPLE"), n("CONVERSATION"), n("SPEAK_ABOUT_THE_PHOTO"), n("READ_THEN_SPEAK"), n("SPEAKING_SAMPLE")], [3, 2, 2, 2, 1, 1, 1]);
  assert.deepEqual({ packNo: pack.packNo, author: pack.author, date: pack.date }, { packNo: 1, author: "beta-g", date: "2026-11-08" });
  assert.equal(pack.items.flatMap((i) => i.answers).length, 30);
  for (const c of pack.items.filter((i) => i.kind === "CONVERSATION")) assert.equal(c.script.length, 8);
  for (const p of pack.items.filter((i) => i.kind === "PHOTO")) assert.ok(p.imageDescription && p.imageDescription.length > 40);
});
await t("word counts recomputed equal every row of the pack's own table (30 rows)", () => {
  assert.equal(pack.wordTable.length, 30);
  for (const it of pack.items) for (const a of it.answers) {
    const row = pack.wordTable.find((r) => r.key === it.key && r.level === a.level);
    assert.ok(row, `no row for ${it.key} ${a.level}`);
    if (row.total !== null) assert.equal(countWords(a.text), row.total, `${it.key} ${a.level}`);
    else assert.deepEqual(a.parts.map((p) => countWords(p.text)), [row.part1, row.part2], `${it.key} ${a.level}`);
  }
});
const r1 = importPacks([pack], clean, existing);
await t("import: 11 in (5 ready, 4 image pending, 2 audio pending), 1 blocked (Interactive Writing 2: title already used)", () => {
  const st = (s: string) => r1.data.items.filter((i) => i.status === s).map((i) => i.key).sort();
  assert.deepEqual(st("ready"), ["Interactive Writing 1", "Read, Then Speak (20 seconds to prepare, 90 seconds)", "Speaking Sample (30 seconds to prepare, 3 minutes)", "Writing Sample 1", "Writing Sample 2"]);
  assert.deepEqual(st("image-pending"), ["Photo 1", "Photo 2", "Photo 3", "Speak About the Photo (20 seconds to prepare, 90 seconds)"]);
  assert.deepEqual(st("audio-pending"), ["Conversation 1", "Conversation 2"]);
  assert.equal(r1.blocked.length, 1); assert.match(r1.blocked[0].where, /Interactive Writing 2$/); assert.match(r1.blocked[0].reasons[0], /already used/);
});
await t("the data in the repo IS this pack's import (nothing edited by hand)", () => {
  assert.equal(JSON.stringify(mergeData(null, r1.data), null, 1), JSON.stringify(COMMITTED, null, 1));
});
await t("idempotent: importing again, and merging into itself, gives byte-identical data; ids are stable", () => {
  const r2 = importPacks([load()], clean, existing);
  assert.equal(JSON.stringify(r2.data), JSON.stringify(r1.data));
  assert.equal(JSON.stringify(mergeData(r1.data, r2.data)), JSON.stringify(r1.data));
  assert.deepEqual(r1.data.items.map((i) => i.id).slice(0, 3), ["det-p1-conversation-1", "det-p1-conversation-2", "det-p1-interactive-writing-1"]);
});
await t("every model answer is copied exactly from the pack", () => {
  for (const it of r1.data.items) for (const a of it.answers) assert.ok(SRC.includes(a.parts[0].text.split("\n\n")[0]), `${it.key} ${a.level}`);
});

console.log("gates");
await t("grammar gate: a planted spelling error in a 130+ answer blocks that item, and it stays out of the data and the seed", () => {
  const r = importPacks([pack], flag("enjoyable"), existing); // not in the pack: nothing blocked
  assert.equal(r.blocked.length, 1);
  const bad = importPacks([load(SRC.replace("I made the mistake of leaving", "I made the mistake of leavving"))], flag("leavving"), existing);
  const b = bad.blocked.find((x) => /Interactive Writing 1$/.test(x.where));
  assert.ok(b, "planted spelling error did not block"); assert.equal(b.findings[0].text, "leavving");
  assert.ok(!bad.data.items.some((i) => i.key === "Interactive Writing 1"));
  assert.ok(!seedRows(bad.data, DEFAULTS).some((r) => r.title === "Learning from mistakes"));
});
await t("grammar gate: a planted error in a 110 answer or a note blocks; style hints never block", () => {
  const r = importPacks([pack], flag("Last year, I forgot", "TYPOS"), existing);
  assert.ok(r.blocked.some((x) => /Interactive Writing 1$/.test(x.where) && x.reasons.some((y) => /^110 answer/.test(y))), "planted spelling error in a 110 answer missed");
  const n = importPacks([pack], flag("practical examples", "GRAMMAR", "grammar"), existing);
  assert.ok(n.blocked.some((x) => /Interactive Writing 1$/.test(x.where) && x.reasons.some((y) => /notes/.test(y))), "planted error in a note missed");
  const s = importPacks([pack], flag("Ironically", "STYLE", "style"), existing);
  assert.equal(s.blocked.length, 1);
});
await t("85 level: its mistakes never block; a quoted mistake in a note never blocks", () => {
  const r = importPacks([pack], flag("There is people"), existing); // an 85 answer, and quoted in the notes
  assert.equal(r.blocked.length, 1);
});
await t("85 level: notes that name no mistake block the item", () => {
  const md = SRC.replace("**Notes:** very short; tense errors (*I make mistake*, *I dont study*, *I get*, *I learn*), agreement errors (*My parents was*, *Everybody make*), and almost no development.", "**Notes:** very short and almost no development.");
  assert.notEqual(md, SRC);
  const r = importPacks([load(md)], clean, existing);
  assert.ok(r.blocked.some((x) => /Interactive Writing 1$/.test(x.where) && x.reasons.some((y) => /name no mistake/.test(y))), "85 notes that name no mistake were accepted");
});
await t("word-count gate: a table that differs from the text blocks the item", () => {
  const md = SRC.replace("| Writing Sample 1 | 130+ | 159 |", "| Writing Sample 1 | 130+ | 158 |");
  assert.notEqual(md, SRC);
  const r = importPacks([load(md)], clean, existing);
  assert.ok(r.blocked.some((x) => /Writing Sample 1$/.test(x.where) && x.reasons.some((y) => /word count differs/.test(y))), "word count 159 vs table 158 accepted");
});

console.log("pending and seed");
await t("a pending item (image or audio) never becomes a row, and the reader hides it", () => {
  for (const it of r1.data.items.filter((i) => i.status !== "ready")) {
    assert.throws(() => seedRowFor(it, DEFAULTS), /never seeded/);
    assert.equal(modelAnswersFor(it.taskType, it.title), null);
  }
  assert.equal(seedRows(r1.data, DEFAULTS).length, 5);
  assert.deepEqual(FACTORY_ITEMS.map((i) => i.title).sort(), ["A few close friends", "A skill you would like to learn", "Learning from mistakes", "Learning online", "Social media and friendship"]);
  assert.ok(modelAnswersFor("WRITING_SAMPLE", "Learning online"));
});
await t("the rater reference is beta-g's own 130+ note (no new words)", () => {
  for (const r of seedRows(r1.data, DEFAULTS)) assert.ok(SRC.replace(/\*/g, "").includes(String((r.payload.rubric as { reference: string }).reference)), r.title);
});

function fakeDb(start: LiveRow[] = []) {
  const rows = [...start]; let writes = 0;
  return { rows, get writes() { return writes; }, findMany: async (types: string[]) => rows.filter((r) => types.includes(r.taskType)), createMany: async (c: SeedRow[]) => { writes++; rows.push(...c.map((r) => ({ ...r }))); return c.length; } };
}
const ROWS = seedRows(COMMITTED, DEFAULTS);
await t("seed: a dry run writes nothing (and only --confirm WITH FACTORY_WRITE=yes is a write)", async () => {
  assert.equal(writeAllowed([], {}), false);
  assert.equal(writeAllowed(["--confirm"], {}), false);
  assert.equal(writeAllowed([], { FACTORY_WRITE: "yes" }), false);
  assert.equal(writeAllowed(["--confirm"], { FACTORY_WRITE: "yes" }), true);
  const db = fakeDb();
  const r = await runSeed(db, ROWS, writeAllowed([], { FACTORY_WRITE: "yes" }));
  assert.equal(r.plan.create.length, 5); assert.equal(r.written, 0); assert.equal(db.writes, 0); assert.equal(db.rows.length, 0);
});
await t("seed: the write is idempotent (second run creates 0, all 5 'already there and equal')", async () => {
  const db = fakeDb();
  const a = await runSeed(db, ROWS, true);
  assert.equal(a.written, 5);
  const b = await runSeed(db, ROWS, true);
  assert.equal(b.written, 0); assert.equal(b.plan.same.length, 5); assert.equal(db.writes, 1); assert.equal(db.rows.length, 5);
});
await t("seed: a live row that differs is listed, never changed; the same prompt under another title is skipped", () => {
  const live: LiveRow[] = [{ ...ROWS[0], payload: { ...ROWS[0].payload, topic: "changed" } }, { ...ROWS[1], title: "Another title" }];
  const p = planSeed(ROWS, live);
  assert.equal(p.differs.length, 1); assert.equal(p.duplicate.length, 1); assert.equal(p.create.length, 3);
});

console.log(`\n${failed ? "FACTORY TEST FAIL" : "FACTORY TEST PASS"} — ${passed} passed, ${failed} failed`);
