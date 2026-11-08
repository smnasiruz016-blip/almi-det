// RR-401 · every factory gate must turn RED when broken. Break the source, run the factory test, require exit != 0 and a failure naming
// that gate, restore the file byte-for-byte (checked), then the clean run must be GREEN. (Pattern: AlmiPrep RR-393.)
// Run: npx tsx scripts/factory/sabotage-gates.mts
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const CASES = [
  { gate: "grammar gate: spelling", file: "src/lib/factory/grammar-gate.ts", from: 'const BLOCKING_CATEGORIES = new Set(["TYPOS", "GRAMMAR", "CONFUSED_WORDS"]);\nconst BLOCKING_ISSUES = new Set(["misspelling", "grammar"]);', to: 'const BLOCKING_CATEGORIES = new Set(["GRAMMAR", "CONFUSED_WORDS"]);\nconst BLOCKING_ISSUES = new Set(["grammar"]);', fail: "planted spelling error did not block" },
  { gate: "grammar gate: quoted mistakes in notes", file: "src/lib/factory/grammar-gate.ts", from: "if (!isBlockingKind(m) || inQuote(m)) continue;", to: "if (!isBlockingKind(m)) continue;", fail: "a quoted mistake in a note never blocks" },
  { gate: "85-level notes check", file: "src/lib/factory/grammar-gate.ts", from: 'return named ? null : "the notes name no mistake of the 85-level answer (no quoted or italic error)";', to: "return null;", fail: "85 notes that name no mistake were accepted" },
  { gate: "word-count gate", file: "src/lib/factory/import.ts", from: "row.total !== words || partWords !== null", to: "partWords !== null", fail: "word count 159 vs table 158 accepted" },
  { gate: "pending items never seeded", file: "src/lib/factory/seed-rows.ts", from: 'if (it.status !== "ready") throw new Error(', to: 'if (it.status === "never") throw new Error(', fail: "a pending item (image or audio) never becomes a row" },
  { gate: "dry run writes nothing", file: "src/lib/factory/seed-rows.ts", from: 'argv.includes("--confirm") && env.FACTORY_WRITE === "yes"', to: 'argv.includes("--confirm") || env.FACTORY_WRITE === "yes"', fail: "a dry run writes nothing" },
  { gate: "idempotent write", file: "src/lib/factory/seed-rows.ts", from: "const l = live.find((x) => x.taskType === r.taskType && x.title === r.title);", to: "const l = undefined as LiveRow | undefined;", fail: "the write is idempotent" },
];
const run = () => spawnSync("npx", ["tsx", "scripts/factory/factory.test.mts"], { encoding: "utf8", shell: true });
const out: { gate: string; red: boolean; why: string }[] = [];
for (const c of CASES) {
  const raw = readFileSync(c.file, "utf8");
  const crlf = raw.includes("\r\n"), lf = raw.replace(/\r\n/g, "\n");
  if (!lf.includes(c.from)) throw new Error(`anchor missing for: ${c.gate}`);
  try {
    const bad = lf.replace(c.from, c.to);
    writeFileSync(c.file, crlf ? bad.replace(/\n/g, "\r\n") : bad);
    const r = run();
    const text = r.stdout + r.stderr;
    const why = text.split("\n").filter((l) => /^\s+FAIL\s/.test(l)).map((l) => l.trim()).join(" | ");
    out.push({ gate: c.gate, red: r.status !== 0 && text.includes(c.fail), why });
  } finally { writeFileSync(c.file, raw); }
  if (readFileSync(c.file, "utf8") !== raw) throw new Error(`${c.file} NOT restored`);
}
const clean = run();
for (const o of out) console.log(`  [${o.red ? "RED as required" : "STAYED GREEN — BLIND"}] ${o.gate}\n      reason: ${o.why || "(none)"}`);
console.log(`  restored, clean run: ${clean.status === 0 ? "GREEN" : "NOT GREEN"}`);
const ok = out.every((o) => o.red) && clean.status === 0;
console.log(ok ? `\nSABOTAGE PASS — ${out.length}/${out.length} gates turn RED when broken` : "\nSABOTAGE FAIL");
process.exitCode = ok ? 0 : 1;
