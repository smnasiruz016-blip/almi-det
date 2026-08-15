// gate:uniformity — collisions and sameness across the bank.
//
// Per-item checks cannot see any of this. Two failure modes matter:
//
//   COLLISION — `scripts/seed/append.ts` dedupes on (taskType, title). Two items
//   sharing that pair means one is silently never inserted: the bank is smaller
//   than the source, and nothing says so. A title reused across task types is
//   the same hazard one level up — any audit that scopes by title alone merges
//   two different items into one row.
//
//   SAMENESS — repeated stimulus (same sentence, same photo) shortens the bank
//   in practice, and prose that is byte-identical across every item means the
//   per-item field carries no information at all.

import { defineGate, type Bank, type Finding } from "./_bank.mjs";

const dupes = <T,>(xs: T[]): Map<T, number> => {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return new Map([...m].filter(([, c]) => c > 1));
};

export default defineGate("gate:uniformity", async (bank: Bank) => {
  const findings: Finding[] = [];
  const report: string[] = [];

  // ---- U1: the append.ts dedupe key ----
  const keyed = bank.items.map((i) => `${i.taskType}::${i.title}`);
  const dupKeys = dupes(keyed);
  report.push(`  U1 (taskType,title) uniqueness: ${bank.items.length} items, ${dupKeys.size} collision(s)`);
  if (dupKeys.size) {
    findings.push({
      severity: "FAIL",
      code: "DUP-SEED-KEY",
      message:
        `Duplicate (taskType,title) — scripts/seed/append.ts dedupes on this pair, so the second ` +
        `item is silently never written and the live bank is smaller than the source.`,
      items: [...dupKeys].map(([k, c]) => `${k} ×${c}`),
    });
  }

  // ---- U2: title reuse across task types ----
  const titleOwners = new Map<string, Set<string>>();
  for (const i of bank.items) {
    if (!titleOwners.has(i.title)) titleOwners.set(i.title, new Set());
    titleOwners.get(i.title)!.add(i.taskType);
  }
  const crossType = [...titleOwners].filter(([, s]) => s.size > 1);
  report.push(`  U2 title reuse across task types: ${crossType.length}`);
  if (crossType.length) {
    findings.push({
      severity: "WARN",
      code: "TITLE-CROSS-TYPE",
      message: `A title shared by more than one task type makes any title-scoped audit merge distinct items.`,
      items: crossType.map(([t, s]) => `"${t}" in ${[...s].join(", ")}`),
    });
  }

  // ---- U3: repeated stimulus ----
  const stimulus = (i: (typeof bank.items)[number]): string | null => {
    if (typeof i.payload.sentence === "string") return `sentence:${i.payload.sentence.toLowerCase().trim()}`;
    if (typeof i.payload.imageUrl === "string") return `image:${String(i.payload.imageUrl).split("?")[0]}`;
    if (Array.isArray(i.payload.words)) {
      return `words:${(i.payload.words as { text: string }[]).map((w) => w.text.toLowerCase()).sort().join(",")}`;
    }
    return null;
  };
  const stims = bank.items.map(stimulus).filter((s): s is string => s !== null);
  const dupStims = dupes(stims);
  report.push(`  U3 repeated stimulus: ${dupStims.size} reused across ${stims.length} items`);
  if (dupStims.size) {
    findings.push({
      severity: "FAIL",
      code: "DUP-STIMULUS",
      message: `The same stimulus appears in more than one item — the bank is effectively smaller than it counts.`,
      items: [...dupStims].map(([k, c]) => `${k.slice(0, 90)} ×${c}`),
    });
  }

  // ---- U4: topic spread ----
  report.push("");
  const types = [...new Set(bank.items.map((i) => i.taskType))].sort();
  for (const t of types) {
    const items = bank.items.filter((i) => i.taskType === t);
    const tags = new Map<string, number>();
    for (const i of items) tags.set(i.topicTag, (tags.get(i.topicTag) ?? 0) + 1);
    const ranked = [...tags].sort((a, b) => b[1] - a[1]);
    report.push(`  U4 ${t} topics: ${ranked.map(([k, c]) => `${k}=${c}`).join(", ")}`);
    if (ranked[0][1] / items.length >= 0.9 && items.length >= 5) {
      findings.push({
        severity: "WARN",
        code: "TOPIC-CONCENTRATED",
        message: `${t}: ${Math.round((ranked[0][1] / items.length) * 100)}% of items carry topicTag "${ranked[0][0]}" — topic variety is nominal.`,
      });
    }
  }

  // ---- U5: prose that is identical everywhere carries no information ----
  report.push("");
  for (const t of types) {
    const items = bank.items.filter((i) => i.taskType === t);
    for (const field of ["prompt", "guidanceNote"] as const) {
      const vals = new Set(items.map((i) => String(i[field] ?? "")));
      report.push(`  U5 ${t}.${field}: ${vals.size} distinct value(s) over ${items.length} items`);
      if (vals.size === 1 && items.length > 1) {
        findings.push({
          severity: "WARN",
          code: "PROSE-CONSTANT",
          message:
            `${t}.${field} is byte-identical across all ${items.length} items, so it is a task-level ` +
            `constant stored per item — it can never coach a specific item, and it inflates ` +
            `item-to-item text overlap.`,
        });
      }
    }
  }

  return { findings, report };
});
