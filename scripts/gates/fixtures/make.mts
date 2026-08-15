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

  // ================= INTERACTIVE_READING =================
  // Gate test data, built mechanically so each IR check can be seen firing.
  const irBand = (from: number, to: number, n: number): string[] =>
    freq.slice(from, to).filter((w) => w.length >= 5 && DICT.has(w)).slice(0, n);

  const irSet = (title: string, difficulty: string, vocab: string[], opts: {
    optionLens?: number[];
    correctPos?: number;
    echoStem?: boolean;
    kinds?: string[];
    spanCount?: number;
    breakKey?: boolean;
    tooFewOptions?: boolean;
  } = {}) => {
    const spanCount = opts.spanCount ?? 5;
    const spans = Array.from({ length: spanCount }, (_, i) => ({
      id: `s${i + 1}`,
      text: `A ${vocab[i % vocab.length]} may be a ${vocab[(i + 1) % vocab.length]} or a ${vocab[(i + 2) % vocab.length]}.`,
    }));
    const kinds = opts.kinds ?? [
      "COMPLETE_THE_SENTENCES",
      "COMPLETE_THE_PASSAGE",
      "HIGHLIGHT_THE_ANSWER",
      "IDENTIFY_THE_IDEA",
      "TITLE_THE_PASSAGE",
      "COMPLETE_THE_SENTENCES",
    ];
    let n = 0;
    const questions = kinds.map((kind) => {
      const id = `q${++n}`;
      if (kind === "HIGHLIGHT_THE_ANSWER") {
        return {
          kind,
          id,
          stem: "Which sentence reports the finding?",
          correctSpanId: opts.breakKey ? "sZZ" : spans[1].id,
        };
      }
      const lens = opts.optionLens ?? [30, 30, 30, 30];
      const tags = ["Alpha", "Betaa", "Gamma", "Delta"];
      const texts = lens.map((L, i) => `${tags[i]} ${"x".repeat(Math.max(1, L - tags[i].length - 1))}`);
      const pos = opts.correctPos ?? n % texts.length;
      const stem = opts.echoStem
        ? `Which choice mentions the ${vocab[0]} directly?`
        : "Which choice best matches the passage?";
      if (opts.echoStem) texts[pos] = `${texts[pos]} ${vocab[0]}`;
      let options = texts.map((text, i) => ({ id: `${id}o${i + 1}`, text }));
      if (opts.tooFewOptions) options = options.slice(0, 2);
      return { kind, id, stem, options, correctId: options[Math.min(pos, options.length - 1)].id };
    });
    return {
      taskType: "INTERACTIVE_READING",
      skill: "READING",
      title,
      prompt: "Read the passage, then answer the questions.",
      difficulty,
      topicTag: "gate-fixture",
      guidanceNote: "Look back at the passage.",
      payload: { passage: { spans }, questions },
    };
  };

  const irGreen = (o = {}) => [
    irSet("IR fixture — A1", "FOUNDATION", irBand(150, 600, 6), o),
    irSet("IR fixture — B1", "CORE", irBand(2500, 4000, 6), o),
    irSet("IR fixture — C1", "STRETCH", irBand(8500, 9999, 6), o),
  ];

  const withIR = (sets: unknown[]) => [...clone(all), ...(sets as unknown as BankItem[])];

  write("ir-green.json", withIR(irGreen()), "valid IR sets: all 5 kinds, balanced options, rising rarity");
  write("ir-red-lengthtell.json", withIR(irGreen({ optionLens: [10, 10, 10, 60], correctPos: 3 })),
    "correct option is always the longest");
  write("ir-red-position.json", withIR(irGreen({ correctPos: 0 })),
    "correct option is always first");
  write("ir-red-stemoverlap.json", withIR(irGreen({ echoStem: true })),
    "correct option echoes a distinctive stem word the distractors lack");
  write("ir-red-options.json", withIR(irGreen({ tooFewOptions: true })),
    "fewer than three options");
  write("ir-red-spans.json", withIR(irGreen({ spanCount: 2 })),
    "passage spanned too coarsely to hide the highlight answer");
  write("ir-red-key.json", withIR(irGreen({ breakKey: true })),
    "highlight key names a span that does not exist");
  write("ir-red-kinds.json", withIR(irGreen({ kinds: ["COMPLETE_THE_SENTENCES", "IDENTIFY_THE_IDEA", "TITLE_THE_PASSAGE", "COMPLETE_THE_PASSAGE", "COMPLETE_THE_SENTENCES"] })),
    "no HIGHLIGHT_THE_ANSWER anywhere in the bank");
  {
    const sets = irGreen();
    sets[2] = irSet("IR fixture — C1", "STRETCH", irBand(150, 600, 6));
    write("ir-red-rarity.json", withIR(sets), "STRETCH passages no rarer than FOUNDATION");
  }

  // ================= FILL_IN_THE_BLANKS (sentence-scope cloze) =================
  const fibItem = (title: string, difficulty: string, word: string, opts: {
    blanks?: number;
    twoSentences?: number;
    shortPrefix?: boolean;
  } = {}) => {
    const keep = opts.shortPrefix ? 2 : Math.ceil(word.length / 2);
    const mk = (w: string, k: number) => ({
      kind: "blank",
      visiblePrefix: w.slice(0, k),
      missingLetters: w.slice(k),
    });
    const passage: Record<string, unknown>[] = [{ kind: "text", text: "The visitor asked whether the" }];
    const n = opts.blanks ?? 1;
    for (let i = 0; i < n; i++) {
      passage.push({ ...mk(word, keep), id: `b${i + 1}` });
      if (i < n - 1) passage.push({ kind: "text", text: "and also the" });
    }
    passage.push({ kind: "text", text: opts.twoSentences ? "was ready. It had been ready for hours." : "was ready." });
    return {
      taskType: "FILL_IN_THE_BLANKS",
      skill: "READING",
      title,
      prompt: "Complete the word.",
      difficulty,
      topicTag: "gate-fixture",
      guidanceNote: "Read to the end.",
      payload: { passage },
    };
  };

  const fibGreen = (o = {}) => [
    fibItem("FIB fixture — A1", "FOUNDATION", band(150, 600, 1)[0], o),
    fibItem("FIB fixture — B1", "CORE", band(2500, 4000, 1)[0], o),
    fibItem("FIB fixture — C1", "STRETCH", RARE[0], o),
  ];
  // The real bank now HOLDS authored FILL_IN_THE_BLANKS items. A fixture that
  // merely appends would be averaged in with them and could not prove anything
  // about its own type — so the fixture replaces that type entirely.
  const withFIB = (sets: unknown[]) => [
    ...clone(all).filter((i) => i.taskType !== "FILL_IN_THE_BLANKS"),
    ...(sets as unknown as BankItem[]),
  ];

  write("fib-green.json", withFIB(fibGreen()), "valid sentence cloze: one blank, one sentence, rising rarity");
  write("fib-red-blanks.json", withFIB(fibGreen({ blanks: 3 })), "three blanks in a sentence-scope item");
  write("fib-red-twosentences.json", withFIB(fibGreen({ twoSentences: 1 })), "two sentences — a passage wearing the name");
  write("fib-red-ambiguous.json", withFIB(fibGreen({ shortPrefix: true })), "two-letter prefix: far too many words fit for one sentence to resolve");
  {
    // All three FIB levels drawn from the SAME common band, while the real
    // READ_AND_COMPLETE bank keeps its good ladder. A blended check would be
    // dragged green by the larger type; a per-type check must fail.
    const w = band(150, 600, 1)[0];
    const flat = [
      fibItem("FIB fixture — A1", "FOUNDATION", w),
      fibItem("FIB fixture — B1", "CORE", w + ""),
      fibItem("FIB fixture — C1", "STRETCH", w + ""),
    ];
    write("fib-red-rarity.json", withFIB(flat), "FIB ladder flat while the passage-cloze ladder stays good");
  }

  console.log("");
}

main().catch((e) => {
  console.error("fixture generation failed:", e);
  process.exit(1);
});
