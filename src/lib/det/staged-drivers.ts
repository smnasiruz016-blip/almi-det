// The staged-task registry.
//
// Its own module, not part of staged.ts, so the dependency runs one way: the
// task modules import the generic types from staged.ts, and only this file
// imports the task modules. Putting the registry alongside the types would make
// staged.ts and every driver import each other.
//
// PARTIAL, not total — unlike PROJECTORS in client-payload.ts. That difference is
// deliberate. Every task type must declare what the browser may see, so a missing
// projection has to be a compile error. Most task types are NOT staged, and
// requiring an entry here for each of them would be noise that teaches people to
// paste a stub. A task type absent from this map simply has no stage boundary to
// cross, and the advance route 404s for it.

import type { DetTaskType } from "@prisma/client";
import type { StageDriver } from "@/lib/det/staged";
import { IL_STAGE_DRIVER } from "@/lib/det/il-stages";
import { IW_STAGE_DRIVER } from "@/lib/det/tasks/interactive-writing";

export const STAGE_DRIVERS: Partial<Record<DetTaskType, StageDriver>> = {
  INTERACTIVE_LISTENING: IL_STAGE_DRIVER,
  INTERACTIVE_WRITING: IW_STAGE_DRIVER,
};

export function stageDriverFor(taskType: DetTaskType): StageDriver | undefined {
  return STAGE_DRIVERS[taskType];
}

/** Task types whose projection needs DetItemAudio rows. Read by the render seam
 *  so the types with no projected audio do not pay for the query. */
export function stagedNeedsAudio(taskType: DetTaskType): boolean {
  return Boolean(STAGE_DRIVERS[taskType]?.needsAudio);
}
