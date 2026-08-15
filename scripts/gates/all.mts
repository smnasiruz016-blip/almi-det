// gate:all — the one entry point the build and CI call.
//
// Loads the bank ONCE and runs every gate against it, so all findings appear in
// a single run instead of the build dying at the first failure and hiding the
// rest. The process exits non-zero if any gate reports a blocking finding.
//
// `--only=<name>` runs a single gate (used by the npm aliases and by the
// red-first fixture proofs).
//
// GATE_FIXTURE is refused outright here. Fixture mode exists so a gate can be
// proven red before it is trusted; a build that quietly graded a fixture and
// reported green would be the worst of both worlds — a gate that looks installed
// and checks nothing.

import { loadBank, executeGate, type GateDef } from "./_bank.mjs";

import minItems from "./min-items.mjs";
import leak from "./leak.mjs";
import degame from "./degame.mjs";
import cloze from "./cloze.mjs";
import readingSet from "./reading-set.mjs";
import keyTypable from "./key-typable.mjs";
import uniformity from "./uniformity.mjs";

const GATES: GateDef[] = [minItems, leak, degame, cloze, readingSet, keyTypable, uniformity];

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);

async function main(): Promise<void> {
  if (process.env.GATE_FIXTURE && !only) {
    console.error(
      "\n✗ gate:all refuses to run with GATE_FIXTURE set.\n" +
        "  Fixture mode is for proving a single gate red (gate:one --only=<name>).\n" +
        "  A full run must read the real content bank.\n",
    );
    process.exit(1);
  }

  const selected = only ? GATES.filter((g) => g.name === only || g.name === `gate:${only}`) : GATES;
  if (selected.length === 0) {
    console.error(`✗ no gate matches --only=${only}. Known: ${GATES.map((g) => g.name).join(", ")}`);
    process.exit(1);
  }

  const bank = await loadBank();
  const results = [];
  for (const g of selected) results.push(await executeGate(g, bank));

  for (const r of results) console.log(r.lines.join("\n"));

  const totalFails = results.reduce((a, r) => a + r.fails, 0);
  const totalWarns = results.reduce((a, r) => a + r.warns, 0);

  console.log("\n═══ CONTENT GATES ═══════════════════════════════════");
  if (bank.fixtureMode) console.log(`  ⚠ FIXTURE MODE — source: ${bank.fixturePath}`);
  console.log(`  bank: ${bank.items.length} items across ${new Set(bank.items.map((i) => i.taskType)).size} task type(s)`);
  for (const r of results) {
    console.log(`  ${r.fails ? "✗" : "✓"} ${r.name.padEnd(20)} ${r.fails} blocking, ${r.warns} warning(s)`);
  }
  console.log(
    totalFails > 0
      ? `\n✗ BLOCKED — ${totalFails} blocking finding(s), ${totalWarns} warning(s).\n`
      : `\n✓ ALL GATES PASS — ${totalWarns} warning(s).\n`,
  );
  process.exit(totalFails > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("✗ gate:all ERRORED —", e);
  process.exit(1);
});
