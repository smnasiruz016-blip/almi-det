// gate:degame — can the item be answered without the skill it claims to test?
//
// READ_AND_SELECT is the exposed surface: the answer is a real/fake mask over a
// fixed-length word list, so any regularity in that mask is directly exploitable.
// Four independent readings, because each is blind to the others:
//
//   D1 MASK REPEAT     — do items reuse the same real/fake mask?
//   D2 POSITION BIAS   — is a given slot almost always real (or always fake)?
//   D3 COUNT UNIFORM   — is the number of real words constant? ("always pick 5")
//   D4 RUN SHAPE       — a concentration check is blind to runs: a mask that
//                        alternates T,F,T,F,… spreads every position evenly and
//                        looks uniform, while being perfectly predictable. D2
//                        cannot see it; D4 exists for exactly that case.
//
//   D5 DICTIONARY      — before asking if the mask is guessable, ask if it is
//                        TRUE: every "real" word must be in an English word
//                        list, every "invented" word must be absent from it.
//   D6 NEAR-COLLISION  — and is the invented word FAIR? One within 2 edits of a
//                        word we key as REAL elsewhere in the same task type is
//                        a trap on our own key, not a test of English.
//
// The other three task types have no answer mask, so what is checked there is
// whether the difficulty label is backed by anything measurable.

import { defineGate, DIFFICULTIES, type Bank, type Finding } from "./_bank.mjs";

const MASK_REPEAT_FAIL = 0.5;
const POSITION_BIAS_FAIL = 0.9;
const COUNT_UNIFORM_FAIL = 0.9;
const COUNT_UNIFORM_WARN = 0.7;

const pct = (n: number, d: number) => (d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`);

const NEAR_EDIT_DISTANCE = 2;
const STEM_LEN = 5;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

function runsOf(mask: boolean[]): number {
  let r = 1;
  for (let i = 1; i < mask.length; i++) if (mask[i] !== mask[i - 1]) r++;
  return r;
}

export default defineGate("gate:degame", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  // ================= READ_AND_SELECT =================
  const ras = bank.items.filter((i) => i.taskType === "READ_AND_SELECT");
  const masks: boolean[][] = ras.map(
    (i) => ((i.payload.words as { real: boolean }[] | undefined) ?? []).map((w) => w.real),
  );

  if (masks.length > 0) {
    const widths = [...new Set(masks.map((m) => m.length))];
    report.push(`  READ_AND_SELECT: ${masks.length} items, list length(s) ${widths.join("/")}`);

    // ---- D1 mask repeat ----
    const counts = new Map<string, number>();
    masks.forEach((m) => {
      const k = m.map((b) => (b ? "R" : "f")).join("");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    report.push(`  D1 mask repeat: ${counts.size} distinct mask(s) across ${masks.length} items`);
    for (const [m, c] of ranked.slice(0, 4)) {
      report.push(`       ${m}  ×${c}  (${pct(c, masks.length)})`);
    }
    const [topMask, topCount] = ranked[0];
    if (topCount / masks.length >= MASK_REPEAT_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "DEGAME-MASK-REPEAT",
        message:
          `The real/fake mask "${topMask}" is reused by ${topCount}/${masks.length} items ` +
          `(${pct(topCount, masks.length)}). A test-taker who learns the mask once scores it on every ` +
          `item without reading a single word — this measures memory of our layout, not reading.`,
      });
    }

    // ---- D2 position bias ----
    const width = Math.max(...masks.map((m) => m.length));
    const posReal: number[] = [];
    const biased: string[] = [];
    for (let p = 0; p < width; p++) {
      const present = masks.filter((m) => m.length > p);
      const real = present.filter((m) => m[p]).length;
      posReal.push(present.length ? real / present.length : 0);
      const rate = present.length ? real / present.length : 0;
      if (rate >= POSITION_BIAS_FAIL || rate <= 1 - POSITION_BIAS_FAIL) {
        biased.push(`slot ${p + 1}: real in ${real}/${present.length} (${pct(real, present.length)})`);
      }
    }
    report.push(`  D2 position bias: ${posReal.map((r) => `${Math.round(r * 100)}%`).join(" ")}`);
    if (biased.length > 0) {
      findings.push({
        severity: "FAIL",
        code: "DEGAME-POSITION-BIAS",
        message: `${biased.length} of ${width} slots are decided by position rather than by the word.`,
        items: biased,
      });
    }

    // ---- D3 real-count uniformity ----
    const nReal = masks.map((m) => m.filter(Boolean).length);
    const cCounts = new Map<number, number>();
    nReal.forEach((n) => cCounts.set(n, (cCounts.get(n) ?? 0) + 1));
    const cRanked = [...cCounts.entries()].sort((a, b) => b[1] - a[1]);
    report.push(
      `  D3 real-word count: ${cRanked.map(([n, c]) => `${n}→${c} item(s)`).join(", ")}`,
    );
    const [topN, topNc] = cRanked[0];
    const share = topNc / nReal.length;
    if (share >= COUNT_UNIFORM_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "DEGAME-COUNT-UNIFORM",
        message:
          `${pct(topNc, nReal.length)} of items have exactly ${topN} real words. ` +
          `"Always select ${topN}" is a strategy that needs no English.`,
      });
    } else if (share >= COUNT_UNIFORM_WARN) {
      findings.push({
        severity: "WARN",
        code: "DEGAME-COUNT-UNIFORM",
        message: `${pct(topNc, nReal.length)} of items have exactly ${topN} real words — vary the count.`,
      });
    }

    // ---- D4 run shape (blind spot of D2) ----
    const runShapes = new Map<string, number>();
    masks.forEach((m) => {
      const k = `${runsOf(m)} runs, starts ${m[0] ? "real" : "fake"}`;
      runShapes.set(k, (runShapes.get(k) ?? 0) + 1);
    });
    const rRanked = [...runShapes.entries()].sort((a, b) => b[1] - a[1]);
    report.push(`  D4 run shape: ${rRanked.map(([k, c]) => `[${k}] ×${c}`).join(", ")}`);
    const [topShape, topShapeC] = rRanked[0];
    if (topShapeC / masks.length >= MASK_REPEAT_FAIL) {
      findings.push({
        severity: "FAIL",
        code: "DEGAME-RUN-SHAPE",
        message:
          `${pct(topShapeC, masks.length)} of items share the run shape [${topShape}]. ` +
          `Position counts can look balanced while the sequence stays this predictable.`,
      });
    }
  }

  // ---- D5 dictionary: is the key true? ----
  //
  // D1-D4 ask whether the mask is guessable. D5 asks the prior question: is the
  // mask CORRECT. A word keyed "invented" that is in fact ordinary English marks
  // a test-taker wrong for knowing the language — the worst failure an item can
  // have. A word keyed "real" that no dictionary recognises marks them wrong for
  // not knowing a word we made up.
  //
  // Word list: an-array-of-english-words (~275k entries, spell-check derived).
  // A genuine false positive belongs in ALLOW_REAL below with a note, never in a
  // loosened threshold — the point of this check is that it is absolute.
  if (masks.length > 0) {
    const wordsModule = await import("an-array-of-english-words");
    const list = (wordsModule.default ?? wordsModule) as unknown as string[];
    const DICT = new Set(list.map((w) => w.toLowerCase()));

    /** Real English words the list happens to omit. Add with a reason. */
    const ALLOW_REAL = new Set<string>([]);
    /** Strings we key as invented that the list happens to contain. Add with a reason. */
    const ALLOW_INVENTED = new Set<string>([]);

    const notReal: string[] = [];
    const actuallyReal: string[] = [];
    let checked = 0;

    for (const it of ras) {
      const words = (it.payload.words as { text: string; real: boolean }[] | undefined) ?? [];
      for (const w of words) {
        const t = w.text.toLowerCase();
        checked++;
        if (w.real && !DICT.has(t) && !ALLOW_REAL.has(t)) {
          notReal.push(`"${w.text}" (${it.title}) — keyed real, absent from the word list`);
        }
        if (!w.real && DICT.has(t) && !ALLOW_INVENTED.has(t)) {
          actuallyReal.push(`"${w.text}" (${it.title}) — keyed invented, but IS an English word`);
        }
      }
    }

    report.push(
      `  D5 dictionary: ${checked} candidate(s) checked against ${DICT.size} English words — ` +
        `${notReal.length} keyed-real unrecognised, ${actuallyReal.length} keyed-invented actually real`,
    );
    if (actuallyReal.length) {
      findings.push({
        severity: "FAIL",
        code: "KEY-INVENTED-IS-REAL",
        message:
          `A word keyed as invented is a real English word. A test-taker who knows it is marked wrong ` +
          `for being right.`,
        items: actuallyReal,
      });
    }
    if (notReal.length) {
      findings.push({
        severity: "FAIL",
        code: "KEY-REAL-NOT-IN-DICTIONARY",
        message:
          `A word keyed as real is not in the English word list. Either it is not a word, or it is a ` +
          `genuine omission that belongs in ALLOW_REAL with a note.`,
        items: notReal,
      });
    }
  }

  // ---- D6 near-collision: is the invented word FAIR? ----
  //
  // D5 asks whether an invented word is a non-word. D6 asks the harder question:
  // is it a non-word the taker can reasonably be expected to reject.
  //
  // An invented word one or two edits from a real word that WE KEY AS REAL
  // elsewhere in the same task type is a trap rather than a lure. The taker who
  // learns "apple" from one item and meets "nopple" in another is being tested
  // on our spelling choices, not on English. The same applies to shared stems:
  // "ubiquitant" alongside a keyed "ubiquitous" invites the reasonable inference
  // that it is a derived form, because English really does derive that way.
  //
  // A lure whose real counterpart is NOT keyed anywhere in the set is fair and
  // stays — that is ordinary word recognition. The rule is specifically about
  // colliding with our own answer key.
  {
    const byType = new Map<string, typeof bank.items>();
    for (const it of bank.items) {
      if (!Array.isArray(it.payload.words)) continue;
      if (!byType.has(it.taskType)) byType.set(it.taskType, []);
      byType.get(it.taskType)!.push(it);
    }

    const collisions: string[] = [];
    let pairsChecked = 0;

    for (const [taskType, group] of byType) {
      const realKeys = new Map<string, string>(); // word -> item title it is keyed real in
      const invented: { word: string; title: string }[] = [];
      for (const it of group) {
        for (const w of it.payload.words as { text: string; real: boolean }[]) {
          if (w.real) { if (!realKeys.has(w.text.toLowerCase())) realKeys.set(w.text.toLowerCase(), it.title); }
          else invented.push({ word: w.text.toLowerCase(), title: it.title });
        }
      }
      for (const inv of invented) {
        for (const [key, keyTitle] of realKeys) {
          pairsChecked++;
          const d = levenshtein(inv.word, key);
          const sharedStem = inv.word.slice(0, STEM_LEN) === key.slice(0, STEM_LEN);
          if (d <= NEAR_EDIT_DISTANCE || sharedStem) {
            collisions.push(
              `${taskType}: invented "${inv.word}" (${inv.title}) vs keyed-real "${key}" (${keyTitle}) — ` +
                (sharedStem ? `shared ${STEM_LEN}-char stem` : `edit distance ${d}`),
            );
          }
        }
      }
    }

    report.push(
      `  D6 near-collision: ${pairsChecked} invented×keyed-real pair(s) compared, ${collisions.length} colliding`,
    );
    if (collisions.length) {
      findings.push({
        severity: "FAIL",
        code: "UNFAIR-NEAR-COLLISION",
        message:
          `An invented word sits within edit distance ${NEAR_EDIT_DISTANCE} of — or shares a ` +
          `${STEM_LEN}-character stem with — a word this same task type keys as REAL. That is a trap on our ` +
          `own answer key, not a test of English. Lures whose real counterpart is not keyed anywhere ` +
          `in the set are fair and are not reported here.`,
        items: collisions,
      });
    }
  }

  // ================= difficulty must be backed by something =================
  report.push("");
  const listen = bank.items.filter((i) => i.taskType === "LISTEN_AND_TYPE");
  if (listen.length) {
    const byDiff = DIFFICULTIES.map((d) => {
      const lens = listen
        .filter((i) => i.difficulty === d)
        .map((i) => String(i.payload.sentence ?? "").trim().split(/\s+/).length);
      return { d, lens, min: Math.min(...lens), max: Math.max(...lens) };
    });
    report.push(
      `  LISTEN_AND_TYPE words/sentence: ${byDiff.map((b) => `${b.d.slice(0, 4)} ${b.min}-${b.max}`).join("  ")}`,
    );
    const separable = byDiff.every((b, i) => i === 0 || b.min > byDiff[i - 1].max);
    if (separable) {
      findings.push({
        severity: "WARN",
        code: "DEGAME-LENGTH-CUE",
        message:
          `Sentence length separates the three difficulty pools with no overlap — length alone ` +
          `predicts the pool. Overlap the ranges so difficulty comes from the language, not the count.`,
      });
    }
  }

  for (const t of ["WRITE_ABOUT_THE_PHOTO", "SPEAK_ABOUT_THE_PHOTO"]) {
    const items = bank.items.filter((i) => i.taskType === t);
    if (!items.length) continue;
    const keys = t === "WRITE_ABOUT_THE_PHOTO" ? ["minWords"] : ["prepSeconds", "speakSeconds"];
    const flat: string[] = [];
    for (const k of keys) {
      const vals = [...new Set(items.map((i) => String(i.payload[k])))];
      report.push(`  ${t} ${k}: ${vals.join(", ")}`);
      if (vals.length === 1) flat.push(`${k} is ${vals[0]} for all ${items.length} items`);
    }
    if (flat.length === keys.length) {
      findings.push({
        severity: "WARN",
        code: "DIFFICULTY-COSMETIC",
        message:
          `${t}: every task parameter is identical across FOUNDATION/CORE/STRETCH, so the ` +
          `difficulty label changes nothing the test-taker experiences or is measured on.`,
        items: flat,
      });
    }
  }

  return { findings, report };
});
