// Session aggregate result. Combines every scored step into the four honest
// subscore ranges + a readiness band (no fabricated overall), then lists each
// step's review. Used for both adaptive sets and the full mock.

import Link from "next/link";
import type { DetAttempt, DetItem, DetSession } from "@prisma/client";
import { aggregateSession } from "@/lib/det/session";
import { overallReadiness } from "@/lib/det/subscores";
import { DET_TASKS } from "@/lib/det/registry";
import { SubscoreRanges } from "@/components/det/SubscoreRanges";
import { TaskReview } from "@/components/det/DetResult";

type AttemptWithItem = DetAttempt & { item: DetItem };

export function DetSessionResult({
  session,
  attempts,
}: {
  session: DetSession;
  attempts: AttemptWithItem[];
}) {
  const scored = attempts.filter((a) => a.status === "SCORED");
  const { estimate, provisional } = aggregateSession(scored);
  const readiness = overallReadiness(estimate);
  const isMock = session.mode === "MOCK";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          {isMock ? "Full-length practice" : "Adaptive practice"} · result
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-almi-ink">Your practice estimate</h1>
        {readiness && (
          <span className="mt-3 inline-block rounded-full bg-almi-coral/10 px-3 py-1 text-sm font-semibold text-almi-coral-deep">
            {readiness}
          </span>
        )}
      </header>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">
          Subscore estimates (10–160 scale)
        </h2>
        <div className="mt-3">
          <SubscoreRanges estimate={estimate} provisional={provisional} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">
          Question by question
        </h2>
        {scored.map((a, i) => (
          <details key={a.id} className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-5">
            <summary className="cursor-pointer text-sm font-semibold text-almi-ink">
              {i + 1}. {DET_TASKS[a.taskType].label} — {a.pointsEarned}/{a.pointsMax} practice points
            </summary>
            <div className="mt-4">
              <TaskReview item={a.item} attempt={a} />
            </div>
          </details>
        ))}
      </section>

      <p className="rounded-xl border border-almi-bg-peach bg-almi-paper px-4 py-3 text-xs text-almi-text-muted">
        This is a practice estimate to guide your prep — not an official Duolingo English Test result.
        {isMock
          ? " A full-length practice run rehearses the format; the real test is adaptive and scored by Duolingo."
          : " Questions adjusted to your level as you went, using our own difficulty pools — this does not reproduce Duolingo's scoring engine."}{" "}
        We show ranges, not a single number. Your real score comes only from an official test.
      </p>

      <Link
        href="/practice"
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep"
      >
        Back to practice →
      </Link>
    </div>
  );
}
