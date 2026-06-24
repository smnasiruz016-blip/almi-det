// Session engine for adaptive sets and the full mock.
//
// ADAPTIVE: a run of items of ONE task type whose difficulty pool
// (FOUNDATION/CORE/STRETCH) moves with the user's performance — genuine
// difficulty-pool adaptivity, NOT a reproduction of DET's proprietary engine.
// Objective tasks run 5 steps (adapting as you go); AI tasks run a single step
// whose difficulty is chosen from the user's recent history.
//
// MOCK: one item per task type across all four skills, aggregated into the four
// honest subscore ranges + a readiness band (still no fabricated overall).

import { Prisma } from "@prisma/client";
import type { DetDifficulty, DetTaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DET_TASKS } from "@/lib/det/registry";
import { fractionToRange, snapRange } from "@/lib/det/scale";
import { combineSubscores, provisionalSubscores } from "@/lib/det/subscores";
import type { DetSkill, Range, SubscoreEstimate, SubscoreKey } from "@/lib/det/types";

export const MOCK_ORDER: DetTaskType[] = [
  "READ_AND_SELECT",
  "LISTEN_AND_TYPE",
  "WRITE_ABOUT_THE_PHOTO",
  "SPEAK_ABOUT_THE_PHOTO",
];

const DIFFICULTIES: DetDifficulty[] = ["FOUNDATION", "CORE", "STRETCH"];
const ADAPTIVE_OBJECTIVE_STEPS = 5;

function fractionOf(a: { pointsEarned: number; pointsMax: number }): number {
  return a.pointsMax ? a.pointsEarned / a.pointsMax : 0;
}

function adaptDifficulty(current: DetDifficulty, fraction: number): DetDifficulty {
  let i = DIFFICULTIES.indexOf(current);
  if (fraction >= 0.8) i = Math.min(DIFFICULTIES.length - 1, i + 1);
  else if (fraction < 0.5) i = Math.max(0, i - 1);
  return DIFFICULTIES[i];
}

async function pickItemId(
  taskType: DetTaskType,
  difficulty: DetDifficulty,
  excludeIds: string[] = [],
): Promise<string | null> {
  const notIn = excludeIds.length ? { id: { notIn: excludeIds } } : {};
  // Prefer the difficulty pool, then any unused item, then anything at all.
  let pool = await prisma.detItem.findMany({
    where: { taskType, active: true, difficulty, ...notIn },
    select: { id: true },
  });
  if (pool.length === 0) {
    pool = await prisma.detItem.findMany({
      where: { taskType, active: true, ...notIn },
      select: { id: true },
    });
  }
  if (pool.length === 0) {
    pool = await prisma.detItem.findMany({
      where: { taskType, active: true },
      select: { id: true },
    });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

async function pickAdaptiveStart(
  userId: string,
  taskType: DetTaskType,
): Promise<DetDifficulty> {
  const recent = await prisma.detAttempt.findMany({
    where: { userId, taskType, status: "SCORED" },
    orderBy: { submittedAt: "desc" },
    take: 5,
    select: { pointsEarned: true, pointsMax: true },
  });
  if (recent.length === 0) return "CORE";
  const fr = recent.reduce((s, a) => s + fractionOf(a), 0) / recent.length;
  if (fr >= 0.8) return "STRETCH";
  if (fr < 0.5) return "FOUNDATION";
  return "CORE";
}

async function createStepAttempt(params: {
  userId: string;
  sessionId: string;
  step: number;
  taskType: DetTaskType;
  difficulty: DetDifficulty;
  excludeIds?: string[];
}): Promise<boolean> {
  const itemId = await pickItemId(params.taskType, params.difficulty, params.excludeIds ?? []);
  if (!itemId) return false;
  await prisma.detAttempt.create({
    data: {
      userId: params.userId,
      itemId,
      taskType: params.taskType,
      status: "IN_PROGRESS",
      sessionId: params.sessionId,
      sessionStep: params.step,
    },
  });
  return true;
}

export async function startSession(input: {
  userId: string;
  mode: "ADAPTIVE" | "MOCK";
  taskType?: DetTaskType;
}): Promise<string | null> {
  if (input.mode === "MOCK") {
    const session = await prisma.detSession.create({
      data: {
        userId: input.userId,
        mode: "MOCK",
        targetCount: MOCK_ORDER.length,
        currentDifficulty: "CORE",
        plan: MOCK_ORDER as unknown as Prisma.InputJsonValue,
      },
    });
    const ok = await createStepAttempt({
      userId: input.userId,
      sessionId: session.id,
      step: 0,
      taskType: MOCK_ORDER[0],
      difficulty: "CORE",
    });
    if (!ok) {
      await prisma.detSession.delete({ where: { id: session.id } });
      return null;
    }
    return session.id;
  }

  const taskType = input.taskType;
  if (!taskType) return null;
  const def = DET_TASKS[taskType];
  const targetCount = def.scoringMode === "DETERMINISTIC" ? ADAPTIVE_OBJECTIVE_STEPS : 1;
  const startDifficulty = await pickAdaptiveStart(input.userId, taskType);
  const session = await prisma.detSession.create({
    data: {
      userId: input.userId,
      mode: "ADAPTIVE",
      taskType,
      targetCount,
      currentDifficulty: startDifficulty,
    },
  });
  const ok = await createStepAttempt({
    userId: input.userId,
    sessionId: session.id,
    step: 0,
    taskType,
    difficulty: startDifficulty,
  });
  if (!ok) {
    await prisma.detSession.delete({ where: { id: session.id } });
    return null;
  }
  return session.id;
}

export async function getSessionView(sessionId: string, userId: string) {
  return prisma.detSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      attempts: { include: { item: true }, orderBy: { sessionStep: "asc" } },
    },
  });
}

export async function advanceSession(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.detSession.findFirst({
    where: { id: sessionId, userId },
    include: { attempts: true },
  });
  if (!session || session.status === "COMPLETED") return;

  const current = session.attempts.find((a) => a.sessionStep === session.currentStep);
  if (!current || current.status !== "SCORED") return; // can't advance until scored

  const nextStep = session.currentStep + 1;
  if (nextStep >= session.targetCount) {
    await prisma.detSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  let nextTask: DetTaskType;
  let nextDifficulty: DetDifficulty;
  if (session.mode === "MOCK") {
    const plan = (session.plan as DetTaskType[] | null) ?? MOCK_ORDER;
    nextTask = plan[nextStep];
    nextDifficulty = "CORE";
  } else {
    if (!session.taskType) return;
    nextTask = session.taskType;
    nextDifficulty = adaptDifficulty(session.currentDifficulty, fractionOf(current));
  }

  const ok = await createStepAttempt({
    userId,
    sessionId: session.id,
    step: nextStep,
    taskType: nextTask,
    difficulty: nextDifficulty,
    excludeIds: session.attempts.map((a) => a.itemId),
  });
  await prisma.detSession.update({
    where: { id: session.id },
    data: {
      currentStep: nextStep,
      currentDifficulty: nextDifficulty,
      // If no item exists for the next step, end the run gracefully.
      ...(ok ? {} : { status: "COMPLETED", completedAt: new Date() }),
    },
  });
}

function averageRanges(ranges: Range[]): Range {
  const lo = ranges.reduce((s, r) => s + r[0], 0) / ranges.length;
  const hi = ranges.reduce((s, r) => s + r[1], 0) / ranges.length;
  return snapRange(lo, hi);
}

/** Aggregate honest subscore ranges from a session's scored attempts. */
export function aggregateSession(
  attempts: { taskType: DetTaskType; status: string; pointsEarned: number; pointsMax: number }[],
): { estimate: SubscoreEstimate; provisional: Set<SubscoreKey> } {
  const bySkillRanges: Partial<Record<DetSkill, Range[]>> = {};
  for (const a of attempts) {
    if (a.status !== "SCORED") continue;
    const def = DET_TASKS[a.taskType];
    const range = fractionToRange(fractionOf(a));
    (bySkillRanges[def.skill] ??= []).push(range);
  }
  const bySkill: Partial<Record<DetSkill, Range>> = {};
  for (const skill of Object.keys(bySkillRanges) as DetSkill[]) {
    bySkill[skill] = averageRanges(bySkillRanges[skill]!);
  }
  return {
    estimate: combineSubscores(bySkill),
    provisional: provisionalSubscores(bySkill),
  };
}
