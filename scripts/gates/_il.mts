// Shared loader for the four Interactive Listening gates.
//
// Each gate needs the same first step — pull the IL items out of the bank and
// parse each payload with the REAL runtime schema — and each gate must react to
// an unparsable payload the same way: report it as a blocking finding, not skip
// it. A gate that silently drops the items it cannot read is a gate that goes
// green on a bank it never looked at.
//
// The schema used here is the one the SERVER parses with at submit time, not a
// re-description of the authored shape. Parsing seed data with a friendlier
// copy of the schema is how a bank passes four gates and then 500s on submit.

import type { Bank, BankItem, Finding } from "./_bank.mjs";
import type { InteractiveListeningPayload } from "../../src/lib/det/types";

export const IL_TASK_TYPE = "INTERACTIVE_LISTENING";

export type ParsedIL = {
  item: BankItem;
  title: string;
  payload: InteractiveListeningPayload;
};

export type ILBank = {
  /** Items whose payload parsed. */
  parsed: ParsedIL[];
  /** How many IL items the bank holds, parsed or not. */
  total: number;
  /** One blocking finding per unparsable payload, or [] when all parsed. */
  findings: Finding[];
};

export async function loadIL(bank: Bank): Promise<ILBank> {
  const { interactiveListeningPayloadSchema } = await import(
    "../../src/lib/det/tasks/interactive-listening"
  );

  const items = bank.items.filter((i) => i.taskType === IL_TASK_TYPE);
  const parsed: ParsedIL[] = [];
  const bad: string[] = [];

  for (const item of items) {
    const res = interactiveListeningPayloadSchema.safeParse(item.payload);
    if (!res.success) {
      bad.push(
        `${item.title}: ${res.error.issues
          .map((i) => `${i.path.join(".") || "(root)"} — ${i.message}`)
          .slice(0, 4)
          .join("; ")}`,
      );
      continue;
    }
    parsed.push({ item, title: item.title, payload: res.data as InteractiveListeningPayload });
  }

  const findings: Finding[] = bad.length
    ? [
        {
          severity: "FAIL",
          code: "IL-PAYLOAD-UNPARSABLE",
          message:
            `An Interactive Listening payload does not parse with the schema the submit route uses. ` +
            `It would be authored, seeded, and then fail at grading time — the gates below cannot ` +
            `see inside it, so it is reported here rather than skipped.`,
          items: bad,
        },
      ]
    : [];

  return { parsed, total: items.length, findings };
}

/** Every string a value tree carries, for value-level leak scanning. */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}
