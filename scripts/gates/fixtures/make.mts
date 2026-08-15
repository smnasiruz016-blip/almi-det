// Builds the fixtures used to prove each gate RED before it is trusted.
//
// Fixtures are DERIVED from the real bank rather than hand-written, so they
// cannot quietly drift away from the shape of real content and start proving
// something else. Regenerate with:  npm run gate:fixtures
//
// Each fixture changes exactly one thing, so a red result names one cause.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank, type BankItem } from "../_bank.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const write = (name: string, items: BankItem[], why: string): void => {
  mkdirSync(HERE, { recursive: true });
  writeFileSync(join(HERE, name), JSON.stringify(items, null, 2));
  console.log(`  wrote ${name.padEnd(26)} ${String(items.length).padStart(3)} items — ${why}`);
};

// Deterministic PRNG so regenerating a fixture never changes it.
function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clone = (items: BankItem[]): BankItem[] => JSON.parse(JSON.stringify(items)) as BankItem[];

async function main(): Promise<void> {
  delete process.env.GATE_FIXTURE; // always derive from the REAL bank
  const bank = await loadBank();
  const all = bank.items;
  console.log(`\nDeriving fixtures from the real bank (${all.length} items):\n`);

  // ---- min-items: Listening one item below the hard floor ----
  {
    const listen = all.filter((i) => i.taskType === "LISTEN_AND_TYPE");
    const drop = new Set(listen.slice(0, listen.length - 14).map((i) => i.title));
    write(
      "min-items-red.json",
      all.filter((i) => !(i.taskType === "LISTEN_AND_TYPE" && drop.has(i.title))),
      "Listening cut to 14 — one below the Rule 7 floor",
    );
  }

  // ---- leak: key visible in the item's own prose ----
  {
    const items = clone(all);
    const l = items.find((i) => i.taskType === "LISTEN_AND_TYPE")!;
    l.guidanceNote = `Remember the phrasing: ${String(l.payload.sentence)}`;
    const r = items.find((i) => i.taskType === "READ_AND_SELECT")!;
    const w = (r.payload.words as { text: string; real: boolean }[])[0];
    r.prompt = `${r.prompt} For example, "${w.text}" is one to think about.`;
    write("leak-red.json", items, "sentence pasted into guidanceNote; candidate word named in prompt");
  }

  // ---- degame: a bank whose masks are actually varied (GREEN control) ----
  {
    const items = clone(all);
    const rnd = mulberry(20260815);
    for (const i of items) {
      if (i.taskType !== "READ_AND_SELECT") continue;
      const words = i.payload.words as { id: string; text: string; real: boolean }[];
      // Keep each word's real/invented status, but shuffle position and vary
      // how many real words an item carries.
      const reals = words.filter((w) => w.real);
      const fakes = words.filter((w) => !w.real);
      const take = 3 + Math.floor(rnd() * 4); // 3..6 real words
      const chosen = [...reals.slice(0, Math.min(take, reals.length)), ...fakes];
      const shuffled = chosen
        .map((w) => ({ w, k: rnd() }))
        .sort((a, b) => a.k - b.k)
        .map(({ w }, idx) => ({ ...w, id: `w${idx + 1}` }));
      i.payload.words = shuffled;
    }
    // The two dialectal words the dictionary check flags in the real bank are
    // swapped for unambiguous non-words, so the control is green on D5 too.
    for (const i of items) {
      if (i.taskType !== "READ_AND_SELECT") continue;
      for (const w of i.payload.words as { text: string; real: boolean }[]) {
        if (w.text === "snodder") w.text = "sprallick";
        if (w.text === "trindle") w.text = "grendisk";
      }
    }
    write("degame-green.json", items, "same words, varied masks/counts/positions — control run");
  }

  // ---- degame D5: a real word keyed invented, and a non-word keyed real ----
  {
    const items = clone(all);
    const r = items.filter((i) => i.taskType === "READ_AND_SELECT");
    const a = r[0].payload.words as { id: string; text: string; real: boolean }[];
    a[0] = { ...a[0], text: "garden", real: false };   // real word keyed invented
    a[2] = { ...a[2], text: "zqxvlorn", real: true };  // non-word keyed real
    write("degame-dict-red.json", items, "'garden' keyed invented; 'zqxvlorn' keyed real");
  }

  // ---- degame D6: an invented word one edit from a word keyed REAL ----
  {
    const items = clone(all);
    const ras = items.filter((i) => i.taskType === "READ_AND_SELECT");
    // "candle" is keyed real in this task type; "candel" is one edit away.
    const victim = ras.find((i) =>
      (i.payload.words as { real: boolean }[]).some((w) => !w.real),
    )!;
    const w = (victim.payload.words as { text: string; real: boolean }[]).find((x) => !x.real)!;
    w.text = "candel";
    write("degame-d6-red.json", items, "invented 'candel' one edit from keyed-real 'candle'");
  }

  // ---- key-typable: a key a plain keyboard cannot reproduce ----
  {
    const items = clone(all);
    const l = items.filter((i) => i.taskType === "LISTEN_AND_TYPE");
    l[0].payload.sentence = "The cat isn’t sleeping on the bed tonight.";  // curly apostrophe
    l[1].payload.sentence = "She bought 15 apples at the market.";              // digits
    write("key-typable-red.json", items, "curly apostrophe in one key; digits in another");
  }

  // ---- uniformity: collisions ----
  {
    const items = clone(all);
    const l = items.filter((i) => i.taskType === "LISTEN_AND_TYPE");
    l[1].title = l[0].title;                       // (taskType,title) collision
    l[2].payload.sentence = l[3].payload.sentence; // repeated stimulus
    write("uniformity-red.json", items, "duplicate (taskType,title); duplicate sentence");
  }

  console.log("");
}

main().catch((e) => {
  console.error("fixture generation failed:", e);
  process.exit(1);
});
