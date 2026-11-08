// RR-401 · the items AlmiDET already has, read from the seed sources (the same arrays scripts/seed/append.ts writes and the gates read).
// No database: the seed modules construct a PrismaClient at module scope, which does not connect; a dummy URL satisfies it.
import type { Existing } from "../../src/lib/factory/import";

export function textOf(payload: unknown): string {
  const p = (payload ?? {}) as { prompt?: unknown; part1?: { prompt?: unknown }; part2?: { prompt?: unknown } };
  return [p.prompt, p.part1?.prompt, p.part2?.prompt].filter((x): x is string => typeof x === "string").join("\n");
}

export async function existingBank(): Promise<Existing[]> {
  process.env.DATABASE_URL ??= "postgresql://factory:factory@localhost:5432/factory";
  process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
  const mods = await Promise.all([
    import("../seed/write-about-photo"),
    import("../seed/interactive-writing"),
    import("../seed/writing-sample"),
    import("../seed/interactive-listening"),
    import("../seed/speak-about-photo"),
    import("../seed/read-then-speak"),
    import("../seed/speaking-sample"),
  ]);
  return mods.flatMap((m) => m.ITEMS).map((i) => ({ taskType: String(i.taskType), title: i.title, text: textOf(i.payload) }));
}
