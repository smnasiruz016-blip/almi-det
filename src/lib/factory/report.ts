/** RR-401 · the gate report section for beta-g (`## AlmiDET` in GATE_REPORT_ROUND2.md). Pure: built from the import result. */
import type { Pack } from "./pack";
import type { ImportResult } from "./import";

export function renderReport(packs: Pack[], res: ImportResult): string {
  const found = packs.reduce((n, p) => n + p.items.length, 0);
  const by = (s: string) => res.data.items.filter((i) => i.status === s);
  const L: string[] = [];
  L.push("## AlmiDET");
  L.push("");
  L.push(`Pack: ${packs.map((p) => p.file).join(", ")}. Gate: LanguageTool en-US on every 130+ and 110 answer, every note, every prompt and every script; the 85 answers are not grammar-checked (their mistakes are on purpose) but their notes must name the mistakes. Word counts must equal the pack's table.`);
  L.push("");
  L.push(`- Items found: ${found}. Passed the gates: ${res.data.items.length}. Blocked: ${res.blocked.length}. Already in AlmiDET (skipped): ${res.skippedDuplicates.length}.`);
  L.push(`- Of those that passed: ready to seed ${by("ready").length}; image pending ${by("image-pending").length}; audio pending ${by("audio-pending").length}.`);
  L.push(`- Texts checked: ${res.checkedTexts}. Style hints (never blocking): ${res.hints}.`);
  L.push("");
  if (!res.blocked.length) L.push("**Blocked: none.**");
  else {
    L.push("### Blocked (they stay out; beta-g fixes them)");
    for (const b of res.blocked) {
      L.push(`- **${b.where}**`);
      for (const r of b.reasons) L.push(`  - ${r}`);
      for (const f of b.findings) L.push(`  - "${f.text}" (${f.rule}, ${f.category}): ${f.message}${f.suggestion ? ` Suggestion: ${f.suggestion}.` : ""} … ${f.snippet} …`);
    }
  }
  for (const d of res.skippedDuplicates) L.push(`- Skipped: ${d}`);
  const pend = res.data.items.filter((i) => i.status !== "ready");
  if (pend.length) {
    L.push("");
    L.push("### Pending (passed the gates; hidden until the asset exists)");
    for (const i of pend) L.push(`- ${i.key} "${i.title}": ${i.status}. ${i.pendingReason}`);
  }
  const cc = res.data.items.filter((i) => i.titleFrom === "cc");
  if (cc.length) {
    L.push("");
    L.push("### Titles CC gave (the pack has none; beta-g to confirm)");
    for (const i of cc) L.push(`- ${i.key}: "${i.title}"`);
  }
  return L.join("\n") + "\n";
}
