// Practice hub — the logged-in "Choose a Test" page. Lists the four DET tasks
// from the registry as adaptive practice, plus the full-length mock. Objective
// tasks are free; AI feedback tasks and the mock need a subscription.

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { DET_TASKS, TASK_ORDER } from "@/lib/det/registry";
import { SUBSCORE_LABEL } from "@/lib/det/types";

export default async function PracticePage() {
  await requireUser();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          AlmiDET · Duolingo English Test practice
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-almi-ink">Choose a task</h1>
        <p className="mt-2 max-w-2xl text-sm text-almi-text">
          Objective tasks run as adaptive sets — questions adjust to your level as you go. Each gives
          an honest estimate, on the 10–160 scale, of where the subscores it touches sit — shown as a
          range, never a single number.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TASK_ORDER.map((t) => {
          const def = DET_TASKS[t];
          const subs = def.feedsSubscores.map((s) => SUBSCORE_LABEL[s]).join(" + ");
          const tag = def.scoringMode === "AI" ? "AI feedback · Pro" : "Auto-marked · Free";
          const inner = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-almi-ink">{def.label}</h2>
                <span className="text-xs text-almi-text-muted">
                  {def.live ? tag : "Coming soon"}
                </span>
              </div>
              <p className="mt-2 text-sm text-almi-text">{def.blurb}</p>
              <p className="mt-3 text-xs text-almi-text-muted">Informs: {subs}</p>
              <p className="mt-3 text-sm font-semibold">
                {def.live ? (
                  <span className="text-almi-coral">Practise →</span>
                ) : (
                  <span className="text-almi-text-muted">Coming soon</span>
                )}
              </p>
            </>
          );
          return def.live ? (
            <Link
              key={t}
              href={`/practice/${def.slug}`}
              className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6 shadow-sm transition hover:border-almi-accent"
            >
              {inner}
            </Link>
          ) : (
            <div key={t} className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-6 opacity-80">
              {inner}
            </div>
          );
        })}
      </div>

      <Link
        href="/practice/mock"
        className="block rounded-2xl border border-almi-coral/40 bg-almi-coral/10 p-6 shadow-sm transition hover:border-almi-coral"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-xl">🏁</span>
              <h2 className="text-lg font-semibold text-almi-ink">Full-length practice</h2>
              <span className="rounded-full bg-almi-coral px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-almi-ink">
                Pro
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm text-almi-text">
              All four skills back to back, then the four honest subscore ranges + a readiness band.
              No fabricated overall.
            </p>
          </div>
          <span className="text-sm font-semibold text-almi-coral">Start full-length practice →</span>
        </div>
      </Link>

      <p className="text-xs text-almi-text-muted">
        Every task here is written from scratch by AlmiDET. We never copy or reproduce Duolingo&apos;s
        test material. Scores are practice estimates, not official Duolingo English Test results.
      </p>
    </div>
  );
}
