// Attempt page: status-switched. IN_PROGRESS → the composer; SCORED → the
// honest result. The composer receives a SANITIZED payload (objective answer
// keys removed) so the key never reaches the browser.

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAttempt } from "@/lib/det/attempts";
import { taskBySlug } from "@/lib/det/registry";
import { DetComposer } from "@/components/det/composer-map";
import { DetResult } from "@/components/det/DetResult";
import type { DetTaskType } from "@prisma/client";

// Strip any server-only answer key before sending the payload to the client.
function sanitizePayload(taskType: DetTaskType, payload: unknown): unknown {
  if (taskType === "READ_AND_SELECT") {
    const p = payload as { words: { id: string; text: string; real: boolean }[] };
    return { words: p.words.map((w) => ({ id: w.id, text: w.text })) };
  }
  return payload;
}

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ task: string; attemptId: string }>;
}) {
  const user = await requireUser();
  const { task, attemptId } = await params;
  const def = taskBySlug(task);
  if (!def) notFound();

  const attempt = await getAttempt(attemptId, user.id);
  if (!attempt || attempt.taskType !== def.taskType) notFound();

  if (attempt.status === "SCORED") {
    return <DetResult def={def} item={attempt.item} attempt={attempt} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          {def.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-almi-ink">{attempt.item.title}</h1>
      </header>
      <DetComposer
        attemptId={attempt.id}
        taskType={attempt.taskType}
        prompt={attempt.item.prompt}
        payload={sanitizePayload(attempt.taskType, attempt.item.payload)}
      />
    </div>
  );
}
