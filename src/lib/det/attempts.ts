// Server helpers for DET practice attempts: pick an item and open an attempt,
// and load an attempt (ownership-scoped) with its item.

import { prisma } from "@/lib/prisma";
import type { DetTaskType } from "@prisma/client";

/**
 * Open a new attempt for the user on a random active item of the given task
 * type. v1 picks uniformly from a fixed difficulty pool (no true adaptivity).
 * Returns the new attempt id, or null if no item exists yet (unseeded).
 */
export async function startAttempt(
  userId: string,
  taskType: DetTaskType,
): Promise<string | null> {
  const items = await prisma.detItem.findMany({
    where: { taskType, active: true },
    select: { id: true },
  });
  if (items.length === 0) return null;
  const pick = items[Math.floor(Math.random() * items.length)];

  const attempt = await prisma.detAttempt.create({
    data: { userId, itemId: pick.id, taskType, status: "IN_PROGRESS" },
  });
  return attempt.id;
}

export async function getAttempt(attemptId: string, userId: string) {
  return prisma.detAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { item: true },
  });
}
