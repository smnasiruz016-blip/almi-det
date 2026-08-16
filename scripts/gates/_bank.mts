// THE SEAM.
//
// Every content gate reads the bank through this module and nowhere else.
//
// AlmiDET authors its practice content as inline `item(...)` literals inside
// scripts/seed/*.ts — there is no seed JSON. A gate ported from a sibling that
// looks for JSON would find nothing and pass green on an empty set (the trap
// that shipped in AlmiTOEFL). So the seam imports the seed modules' exported
// ITEMS arrays directly: the same arrays `scripts/seed/append.ts` writes to the
// database, so what the gate checks is what actually ships.
//
// DETERMINISTIC BY CONSTRUCTION: no database, no network. The seed modules
// construct a PrismaClient at module scope, so we set a dummy DATABASE_URL
// before importing them — constructing a client does not connect. This is what
// lets the gate run in CI and on a preview build where no database is reachable.
// A separate runtime probe (scripts/gates/runtime-probe.mts) covers the thing
// this file structurally cannot see: rows deactivated in the database.
//
// Skill is DERIVED, never stored. DetItem has no skill column; skill comes from
// registry.DET_TASKS[taskType].skill. loadBank() therefore also reports which
// DetTaskType enum members are missing from DET_TASKS, so a task type added to
// the schema but not the registry HARD-FAILS instead of being silently skipped.

import { readFileSync } from "node:fs";

export type Difficulty = "FOUNDATION" | "CORE" | "STRETCH";
export type Skill = "READING" | "WRITING" | "LISTENING" | "SPEAKING";

export type BankItem = {
  taskType: string;
  skill: Skill;
  title: string;
  prompt: string;
  difficulty: Difficulty;
  topicTag: string;
  guidanceNote: string | null;
  payload: Record<string, unknown>;
};

export type Bank = {
  items: BankItem[];
  /** DetTaskType enum members with no DET_TASKS entry — a hard failure. */
  unmappedTaskTypes: string[];
  /** DET_TASKS entries that produced no authored items. */
  taskTypesWithNoItems: string[];
  /** All task types declared live in the registry. */
  liveTaskTypes: string[];
  /** True when the bank came from a fixture instead of the real seeds. */
  fixtureMode: boolean;
  fixturePath: string | null;
};

export const SKILLS: Skill[] = ["READING", "WRITING", "LISTENING", "SPEAKING"];
export const DIFFICULTIES: Difficulty[] = ["FOUNDATION", "CORE", "STRETCH"];

/**
 * Fixture mode exists ONLY so each gate can be proven RED before it is trusted.
 * It is loud on purpose: a gate that silently audits a stale fixture while
 * reporting green is worse than no gate. `gate:all` refuses to run at all when
 * GATE_FIXTURE is set, so fixture mode can never reach a build.
 */
export function fixturePath(): string | null {
  return process.env.GATE_FIXTURE ?? null;
}

export function fixtureBanner(): string[] {
  const p = fixturePath();
  if (!p) return [];
  return [
    "*".repeat(72),
    "*** FIXTURE MODE — THIS IS NOT THE REAL CONTENT BANK ***",
    `*** source: ${p}`,
    "*** A pass here proves nothing about shipped content.",
    "*".repeat(72),
  ];
}

export async function loadBank(): Promise<Bank> {
  const fx = fixturePath();

  // Registry is safe to import statically-ish (no PrismaClient at module scope),
  // but we load it dynamically alongside everything else to keep one code path.
  const { DET_TASKS } = await import("../../src/lib/det/registry");
  const prisma = await import("@prisma/client");
  const enumMembers: string[] = Object.keys(
    prisma.DetTaskType as unknown as Record<string, string>,
  );
  // Proving REGISTRY-UNMAPPED red would otherwise require editing the Prisma
  // enum and running a migration. In fixture mode only, extra enum members can
  // be injected so the check can be seen firing. Ignored outside fixture mode,
  // and gate:all refuses to run in fixture mode at all.
  if (fx && process.env.GATE_ENUM_EXTRA) {
    enumMembers.push(...process.env.GATE_ENUM_EXTRA.split(",").map((s) => s.trim()).filter(Boolean));
  }

  const mapped = new Set(Object.keys(DET_TASKS));
  const unmappedTaskTypes = enumMembers.filter((m) => !mapped.has(m));
  const liveTaskTypes = Object.values(DET_TASKS)
    .filter((t) => t.live)
    .map((t) => t.taskType as string);

  const skillOf = (taskType: string): Skill | null => {
    const def = (DET_TASKS as Record<string, { skill: Skill } | undefined>)[taskType];
    return def ? def.skill : null;
  };

  let raw: Record<string, unknown>[];

  if (fx) {
    raw = JSON.parse(readFileSync(fx, "utf8")) as Record<string, unknown>[];
  } else {
    // A real DATABASE_URL is never needed — but PrismaClient's constructor wants
    // one present. Set it before the dynamic imports below execute.
    process.env.DATABASE_URL ??= "postgresql://gate:gate@localhost:5432/gate";
    process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;

    const mods = await Promise.all([
      import("../seed/read-and-select"),
      import("../seed/read-and-complete"),
      import("../seed/interactive-reading"),
      import("../seed/fill-in-the-blanks"),
      import("../seed/listen-and-type"),
      import("../seed/interactive-listening"),
      import("../seed/write-about-photo"),
      import("../seed/interactive-writing"),
      import("../seed/writing-sample"),
      import("../seed/speak-about-photo"),
      import("../seed/read-aloud"),
      import("../seed/read-then-speak"),
      import("../seed/listen-then-speak"),
      import("../seed/speaking-sample"),
      import("../seed/interactive-speaking"),
    ]);
    raw = mods.flatMap((m) => m.ITEMS as unknown as Record<string, unknown>[]);
  }

  const items: BankItem[] = raw.map((r) => {
    const taskType = String(r.taskType);
    const skill = skillOf(taskType);
    if (!skill) {
      // Not silently skipped — an unmapped type is surfaced as a hard failure by
      // gate:min-items via unmappedTaskTypes. Park it under a sentinel so the
      // item still appears in per-type reporting.
      return {
        taskType,
        skill: "READING" as Skill,
        title: String(r.title ?? ""),
        prompt: String(r.prompt ?? ""),
        difficulty: (r.difficulty as Difficulty) ?? "CORE",
        topicTag: String(r.topicTag ?? "general"),
        guidanceNote: (r.guidanceNote as string | null) ?? null,
        payload: (r.payload as Record<string, unknown>) ?? {},
      };
    }
    return {
      taskType,
      skill,
      title: String(r.title ?? ""),
      prompt: String(r.prompt ?? ""),
      difficulty: (r.difficulty as Difficulty) ?? "CORE",
      topicTag: String(r.topicTag ?? "general"),
      guidanceNote: (r.guidanceNote as string | null) ?? null,
      payload: (r.payload as Record<string, unknown>) ?? {},
    };
  });

  const present = new Set(items.map((i) => i.taskType));
  const taskTypesWithNoItems = Object.keys(DET_TASKS).filter((t) => !present.has(t));

  return {
    items,
    unmappedTaskTypes,
    taskTypesWithNoItems,
    liveTaskTypes,
    fixtureMode: Boolean(fx),
    fixturePath: fx,
  };
}

// ---- shared reporting ----

export type Finding = {
  severity: "FAIL" | "WARN";
  code: string;
  message: string;
  items?: string[];
};

export type GateDef = {
  name: string;
  run: (bank: Bank) => Promise<{ findings: Finding[]; report: string[] }>;
};

export function defineGate(name: GateDef["name"], run: GateDef["run"]): GateDef {
  return { name, run };
}

export type GateResult = { name: string; fails: number; warns: number; lines: string[] };

/** Executes one gate against an already-loaded bank. Never exits the process —
 *  scripts/gates/all.mts owns the exit code so one failing gate cannot hide the
 *  results of the others. */
export async function executeGate(def: GateDef, bank: Bank): Promise<GateResult> {
  const lines: string[] = [`\n─── ${def.name} ─────────────────────────────────────────`];
  let findings: Finding[];
  let report: string[];
  try {
    ({ findings, report } = await def.run(bank));
  } catch (e) {
    lines.push(`  ERRORED: ${e instanceof Error ? e.stack : String(e)}`);
    lines.push(`\n✗ ${def.name}: ERRORED — treated as a failure.`);
    return { name: def.name, fails: 1, warns: 0, lines };
  }
  lines.push(...report);

  const fails = findings.filter((f) => f.severity === "FAIL");
  const warns = findings.filter((f) => f.severity === "WARN");

  if (findings.length > 0) {
    lines.push("");
    for (const f of findings) {
      lines.push(`  [${f.severity}] ${f.code}: ${f.message}`);
      for (const it of (f.items ?? []).slice(0, 12)) lines.push(`         · ${it}`);
      const extra = (f.items ?? []).length - 12;
      if (extra > 0) lines.push(`         · …and ${extra} more`);
    }
  }

  lines.push("");
  lines.push(
    fails.length > 0
      ? `✗ ${def.name}: FAIL — ${fails.length} blocking, ${warns.length} warning(s)`
      : `✓ ${def.name}: PASS${warns.length ? ` — ${warns.length} warning(s)` : ""}`,
  );
  return { name: def.name, fails: fails.length, warns: warns.length, lines };
}
