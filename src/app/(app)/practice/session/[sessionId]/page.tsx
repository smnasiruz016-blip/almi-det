// Session driver: walks the user through an adaptive set or the full mock.
// IN_PROGRESS step → composer; SCORED step → per-step result + advance; all
// steps done → the aggregate result. Advancing is an explicit server action so
// adaptive difficulty is chosen from the step the user just finished.

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSessionView, advanceSession } from "@/lib/det/session";
import { DET_TASKS } from "@/lib/det/registry";
import { DetComposer } from "@/components/det/composer-map";
import { DetResult } from "@/components/det/DetResult";
import { DetSessionResult } from "@/components/det/DetSessionResult";
import type { DetTaskType } from "@prisma/client";

// Strip any server-only answer key before sending the payload to the client.
function sanitizePayload(taskType: DetTaskType, payload: unknown): unknown {
  if (taskType === "READ_AND_SELECT") {
    const p = payload as { words: { id: string; text: string; real: boolean }[] };
    return { words: p.words.map((w) => ({ id: w.id, text: w.text })) };
  }
  if (taskType === "LISTEN_AND_TYPE") {
    return {}; // audio is fetched server-side; the sentence never goes to the client
  }
  return payload;
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await getSessionView(sessionId, user.id);
  if (!session) notFound();

  if (session.status === "COMPLETED") {
    return <DetSessionResult session={session} attempts={session.attempts} />;
  }

  const current = session.attempts.find((a) => a.sessionStep === session.currentStep);
  if (!current) notFound();

  const def = DET_TASKS[current.taskType];
  const stepLabel = `Question ${session.currentStep + 1} of ${session.targetCount}`;
  const isLast = session.currentStep + 1 >= session.targetCount;

  if (current.status === "SCORED") {
    async function advance() {
      "use server";
      const u = await requireUser();
      await advanceSession(sessionId, u.id);
      redirect(`/practice/session/${sessionId}`);
    }
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs font-bold uppercase tracking-wider text-almi-text-muted">{stepLabel}</p>
        <DetResult def={def} item={current.item} attempt={current} variant="step" />
        <form action={advance}>
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
          >
            {isLast ? "See results →" : "Next question →"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          {def.label} · {stepLabel}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-almi-ink">{current.item.title}</h1>
        {session.mode === "ADAPTIVE" && session.targetCount > 1 && (
          <p className="mt-1 text-xs text-almi-text-muted">
            Adaptive practice — questions adjust to your level.
          </p>
        )}
      </header>
      <DetComposer
        attemptId={current.id}
        taskType={current.taskType}
        prompt={current.item.prompt}
        payload={sanitizePayload(current.taskType, current.item.payload)}
      />
    </div>
  );
}
