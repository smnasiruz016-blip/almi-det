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

  // ================= READ_AND_COMPLETE (cloze) =================
  //
  // These passages are GATE TEST DATA, not candidate content — they are built
  // mechanically so each check can be seen firing. Real passages are authored.
  const { createRequire } = await import("node:module");
  const { readFileSync } = await import("node:fs");
  const req = createRequire(import.meta.url);
  const freq: string[] = readFileSync(
    req.resolve("most-common-words-by-language/build/resources/english.txt"),
    "utf8",
  )
    .split(String.fromCharCode(10))
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const dictMod = await import("an-array-of-english-words");
  const DICT = new Set(((dictMod.default ?? dictMod) as unknown as string[]).map((w) => w.toLowerCase()));

  /** Words at a given rarity band that are also in the dictionary and long
   *  enough to split into a prefix plus >=2 missing letters. */
  const band = (from: number, to: number, n: number): string[] =>
    freq.slice(from, to).filter((w) => w.length >= 6 && DICT.has(w)).slice(0, n);

  const RARE = ["meticulous", "ubiquitous", "ephemeral", "resilient", "pragmatic", "coherent"]
    .filter((w) => DICT.has(w));

  const blank = (w: string) => {
    const keep = Math.ceil(w.length / 2);
    return { kind: "blank", visiblePrefix: w.slice(0, keep), missingLetters: w.slice(keep) };
  };

  const clozeItem = (title: string, difficulty: string, words: string[]) => {
    let n = 0;
    const passage: Record<string, unknown>[] = [{ kind: "text", text: "In the report we read that" }];
    for (const w of words) {
      passage.push({ ...blank(w), id: `b${++n}` });
      passage.push({ kind: "text", text: "and then the next line said" });
    }
    passage.push({ kind: "text", text: "which closed the section." });
    return {
      taskType: "READ_AND_COMPLETE",
      skill: "READING",
      title,
      prompt: "Type the missing letters.",
      difficulty,
      topicTag: "gate-fixture",
      guidanceNote: "Use the sentence around each gap.",
      payload: { passage },
    };
  };

  const clozeGreen = () => [
    clozeItem("Cloze fixture — A1", "FOUNDATION", band(150, 600, 6)),
    clozeItem("Cloze fixture — B1", "CORE", band(2500, 4000, 6)),
    clozeItem("Cloze fixture — C1", "STRETCH", RARE.slice(0, 6)),
  ];

  {
    write("cloze-green.json", [...clone(all), ...(clozeGreen() as unknown as BankItem[])],
      "valid cloze: >=5 blanks, real words, context, rising rarity");
  }
  {
    const c = clozeGreen();
    (c[0].payload.passage as Record<string, unknown>[])[1].missingLetters = "zzqx";
    write("cloze-red-notword.json", [...clone(all), ...(c as unknown as BankItem[])],
      "a completion that is not an English word");
  }
  {
    const c = clozeGreen();
    (c[0].payload.passage as Record<string, unknown>[])[1].missingLetters = "te-r";
    write("cloze-red-key.json", [...clone(all), ...(c as unknown as BankItem[])],
      "missingLetters containing punctuation (untypable as keyed)");
  }
  {
    const c = clozeGreen();
    const p = c[0].payload.passage as Record<string, unknown>[];
    const full = `${p[1].visiblePrefix}${p[1].missingLetters}`;
    p[2] = { kind: "text", text: `the word ${full} appeared again in full` };
    write("cloze-red-giveaway.json", [...clone(all), ...(c as unknown as BankItem[])],
      "the blanked word printed un-blanked in the same passage");
  }
  {
    const c = clozeGreen();
    c[0].payload.passage = (c[0].payload.passage as Record<string, unknown>[]).filter((t) => t.kind === "blank");
    write("cloze-red-nocontext.json", [...clone(all), ...(c as unknown as BankItem[])],
      "a passage of bare gaps with no readable text");
  }
  {
    const c = clozeGreen();
    c[0].payload.passage = (c[0].payload.passage as Record<string, unknown>[]).slice(0, 7);
    write("cloze-red-thin.json", [...clone(all), ...(c as unknown as BankItem[])],
      "a passage below the 5-blank floor");
  }
  {
    const c = clozeGreen();
    // STRETCH built from the SAME common band as FOUNDATION -> flat rarity ladder
    c[2] = clozeItem("Cloze fixture — C1", "STRETCH", band(150, 600, 6));
    write("cloze-red-rarity.json", [...clone(all), ...(c as unknown as BankItem[])],
      "STRETCH words no rarer than FOUNDATION (cosmetic difficulty)");
  }

  console.log("");
}

main().catch((e) => {
  console.error("fixture generation failed:", e);
  process.exit(1);
});
