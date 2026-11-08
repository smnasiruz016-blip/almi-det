/**
 * RR-401 · the grammar gate (owner, 7 Nov 2026: "beta-g and the machine both check"). Pure: it classifies LanguageTool matches that
 * the importer fetched; it never calls the network itself, so it is tested on fixtures. (Pattern: AlmiPrep RR-393.)
 *
 * AlmiDET is American English (the pack says so), so the gate reads en-US only. A match BLOCKS when it is a real spelling or grammar
 * error. Style-only hints never block. Words on the allowlist never block. Inside a note, a quoted learner mistake ("There is people")
 * is the point of the note, so text inside quotes never blocks.
 */

export type LtMatch = {
  offset: number;
  length: number;
  message: string;
  replacements?: { value: string }[];
  rule: { id: string; issueType?: string; category: { id: string; name?: string } };
};

const BLOCKING_CATEGORIES = new Set(["TYPOS", "GRAMMAR", "CONFUSED_WORDS"]);
const BLOCKING_ISSUES = new Set(["misspelling", "grammar"]);

/** our own names and the exam's; nothing else */
export const ALLOWLIST = new Set(["AlmiDET", "AlmiWorld", "DET", "Duolingo", "beta-g"].map((w) => w.toLowerCase()));

export const isBlockingKind = (m: LtMatch) => BLOCKING_CATEGORIES.has(m.rule.category.id) || BLOCKING_ISSUES.has(m.rule.issueType ?? "");

/** ranges of text inside double quotes (straight or curly): quoted learner mistakes in notes */
export function quotedRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /"[^"\n]*"|“[^”\n]*”/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out;
}

export type GateFinding = { text: string; offset: number; snippet: string; rule: string; category: string; message: string; suggestion: string };

/** the blocking findings in LanguageTool's en-US matches for `text` */
export function blockingFindings(text: string, us: LtMatch[], opts: { quotesExempt?: boolean } = {}): GateFinding[] {
  const quotes = opts.quotesExempt ? quotedRanges(text) : [];
  const inQuote = (m: LtMatch) => quotes.some(([a, b]) => m.offset >= a && m.offset + m.length <= b);
  const out: GateFinding[] = [];
  for (const m of us) {
    if (!isBlockingKind(m) || inQuote(m)) continue;
    const word = text.slice(m.offset, m.offset + m.length);
    if (ALLOWLIST.has(word.toLowerCase())) continue;
    out.push({
      text: word,
      offset: m.offset,
      snippet: text.slice(Math.max(0, m.offset - 40), m.offset + m.length + 40).replace(/\s+/g, " "),
      rule: m.rule.id,
      category: m.rule.category.id,
      message: m.message,
      suggestion: (m.replacements ?? []).slice(0, 3).map((r) => r.value).join(" / "),
    });
  }
  return out;
}

/** style-only hints, kept for information: they never block */
export const hintCount = (us: LtMatch[]) => us.filter((m) => !isBlockingKind(m)).length;

/** The 85 level is not grammar-gated: its mistakes are on purpose. Its notes must instead exist and NAME its errors (at least one
 *  quoted or italic mistake). */
export function lowLevelNotesProblem(notes: string | null): string | null {
  if (!notes || notes.trim().length < 10) return "the 85-level answer has no notes";
  const named = quotedRanges(notes).length > 0 || /\*[^*\n]+\*/.test(notes);
  return named ? null : "the notes name no mistake of the 85-level answer (no quoted or italic error)";
}
