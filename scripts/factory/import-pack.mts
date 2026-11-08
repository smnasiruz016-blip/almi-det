// RR-401 · the AlmiDET factory importer. Reads factory pack files (.md, written and checked by beta-g), gates every item, and writes:
//   - src/content/factory/det-model-answers.json  (the app and the factory seed read it; merged by stable id, so re-importing changes nothing)
//   - the gate report section for beta-g          (--report=<path>)
// Grammar: LanguageTool's free public API (no key, no cost), at most 1 request every 3.5 s, every answer cached on disk
// (.factory-cache/, not committed) so a re-import makes no request at all. No database, no AI. (Pattern: AlmiPrep RR-393.)
// Run: npx tsx scripts/factory/import-pack.mts <pack.md> [<pack.md> ...] --report=<path>
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePack } from "../../src/lib/factory/pack";
import { importPacks, mergeData, type Lang, type ModelData } from "../../src/lib/factory/import";
import type { LtMatch } from "../../src/lib/factory/grammar-gate";
import { renderReport } from "../../src/lib/factory/report";
import { existingBank } from "./existing-bank";

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
const reportPath = args.find((a) => a.startsWith("--report="))?.slice(9);
if (!files.length) throw new Error("usage: import-pack.mts <pack.md> ... --report=<path>");

const OUT = join(process.cwd(), "src", "content", "factory", "det-model-answers.json");
const CACHE = join(process.cwd(), ".factory-cache", "languagetool");
mkdirSync(CACHE, { recursive: true });
const key = (text: string, lang: Lang) => createHash("sha256").update(`${lang}\n${text}`).digest("hex");
const cached = (text: string, lang: Lang): LtMatch[] | null => { const f = join(CACHE, `${key(text, lang)}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };

async function fetchLt(text: string, lang: Lang): Promise<LtMatch[]> {
  for (let tries = 0; tries < 5; tries++) {
    const r = await fetch("https://api.languagetool.org/v2/check", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "AlmiDET-content-factory/1.0" }, body: new URLSearchParams({ text, language: lang }) });
    if (r.ok) { const j = (await r.json()) as { matches: LtMatch[] }; return j.matches; }
    console.error(`  LanguageTool ${r.status}, waiting`); await new Promise((z) => setTimeout(z, 20000));
  }
  throw new Error("LanguageTool did not answer");
}

const packs = files.map((f) => parsePack(readFileSync(f, "utf8"), f.split(/[\\/]/).pop()!));
const existing = await existingBank();

// pass 1: learn every text the gates will check; fetch what is not cached yet
const wanted: { text: string; lang: Lang }[] = [];
importPacks(packs, (text, lang) => { wanted.push({ text, lang }); return []; }, existing);
let fetched = 0;
for (const { text, lang } of wanted) {
  if (cached(text, lang)) continue;
  const matches = await fetchLt(text, lang);
  writeFileSync(join(CACHE, `${key(text, lang)}.json`), JSON.stringify(matches));
  fetched++;
  await new Promise((z) => setTimeout(z, 3500));
}
// pass 2: the real import, from the cache only
const res = importPacks(packs, (text, lang) => cached(text, lang) ?? (() => { throw new Error("cache miss"); })(), existing);
const prev: ModelData | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const merged = mergeData(prev, res.data);
const body = JSON.stringify(merged, null, 1) + "\n";
const changed = !prev || JSON.stringify(prev, null, 1) + "\n" !== body;
mkdirSync(join(process.cwd(), "src", "content", "factory"), { recursive: true });
if (changed) writeFileSync(OUT, body);
if (reportPath) writeFileSync(reportPath, renderReport(packs, res));
const st = (s: string) => res.data.items.filter((i) => i.status === s).length;
console.log(`packs ${packs.length} · items found ${packs.reduce((n, p) => n + p.items.length, 0)} · imported ${res.data.items.length} (ready ${st("ready")}, image pending ${st("image-pending")}, audio pending ${st("audio-pending")}) · blocked ${res.blocked.length} · duplicates skipped ${res.skippedDuplicates.length} · texts checked ${res.checkedTexts} · style hints (not blocking) ${res.hints} · LanguageTool requests ${fetched} · data ${changed ? "WRITTEN" : "unchanged"}`);
for (const b of res.blocked) console.log(`  BLOCKED ${b.where}: ${b.reasons.join("; ")}${b.findings.length ? ` — ${b.findings.map((f) => `"${f.text}" (${f.rule})`).join(", ")}` : ""}`);
for (const d of res.skippedDuplicates) console.log(`  SKIPPED ${d}`);
