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
import { toClientPayload, needsAudioContext } from "@/lib/det/client-payload";
import { prisma } from "@/lib/prisma";

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

  // Pre-rendered clip URLs, for the one task type whose projection carries audio
  // (Listen and Type fetches its clip through /api/det/audio instead). Guarded so
  // the other six types do not pay for a query they cannot use.
  //
  // A task that projects audio is also a task that projects it PER STAGE:
  // toClientPayload is handed the stored response so the projection can release
  // the current stage only. See src/lib/det/il-stages.ts.
  const audio: Record<number, string> = {};
  if (needsAudioContext(current.taskType)) {
    const rows = await prisma.detItemAudio.findMany({
      where: { itemId: current.itemId },
      select: { seg: true, audioUrl: true },
    });
    for (const r of rows) if (r.audioUrl) audio[r.seg] = r.audioUrl;
  }

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
        // `title` is already rendered as the <h1> above, so reusing it as the
        // image's alt text adds no information the taker cannot already see —
        // unlike the rater target, which is now withheld entirely.
        title={current.item.title}
        payload={toClientPayload(current.taskType, current.item.payload, {
          audio,
          stored: current.response,
        })}
      />
    </div>
  );
}
