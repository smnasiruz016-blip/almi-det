// Costs — what AlmiDET is spending on AI, read from AICostLedger.
//
// Until this page existed the ledger was WRITE-ONLY: three create() calls in
// lib/ai/anthropic-client.ts and lib/ai/openai.ts, and not one read anywhere in
// the codebase. Spend was being recorded faithfully and looked at by nobody.
//
// Two things it is for:
//   1. Proving the Listen and Type pre-render worked. The fix is only real when
//      `listen-and-type.tts` STOPS accruing as clips are replayed — a code diff
//      does not prove that, this number does.
//   2. Catching a single heavy account before it shows up on an invoice, via
//      top-spenders (AICostLedger.userId is populated for user-triggered calls).
//
// Failures are listed separately because they are recorded with costCents 0 and
// would otherwise vanish into a total: a burst of errors is invisible in money
// but very visible here.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/founder";
import { formatCents } from "@/lib/ai/cost";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Costs — Admin",
  robots: { index: false, follow: false },
};

const TOP_USERS = 20;
const RECENT_FAILURES = 20;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function windowTotal(since: Date | null) {
  const agg = await prisma.aICostLedger.aggregate({
    where: since ? { timestamp: { gte: since } } : undefined,
    _sum: { costCents: true },
    _count: { _all: true },
  });
  // A null sum means NO ROWS — zero spent, not a broken query.
  return { cents: agg._sum.costCents ?? 0, calls: agg._count._all };
}

export default async function CostsPage() {
  const user = await requireUser();
  if (!isAdmin(user.email)) redirect("/");

  const [today, week, month, allTime, byFeature, byModel, failures, topRaw] = await Promise.all([
    windowTotal(startOfToday()),
    windowTotal(daysAgo(7)),
    windowTotal(daysAgo(30)),
    windowTotal(null),
    prisma.aICostLedger.groupBy({
      by: ["feature"],
      _sum: { costCents: true },
      _count: { _all: true },
      orderBy: { _sum: { costCents: "desc" } },
    }),
    prisma.aICostLedger.groupBy({
      by: ["model"],
      _sum: { costCents: true },
      _count: { _all: true },
      orderBy: { _sum: { costCents: "desc" } },
    }),
    prisma.aICostLedger.findMany({
      where: { success: false },
      orderBy: { timestamp: "desc" },
      take: RECENT_FAILURES,
      select: { id: true, timestamp: true, feature: true, model: true, errorMessage: true },
    }),
    prisma.aICostLedger.groupBy({
      by: ["userId"],
      where: { userId: { not: null } },
      _sum: { costCents: true },
      _count: { _all: true },
      orderBy: { _sum: { costCents: "desc" } },
      take: TOP_USERS,
    }),
  ]);

  // Resolve the top spenders' emails in one query rather than N.
  const ids = topRaw.map((r) => r.userId).filter((x): x is string => x !== null);
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const card = "rounded-2xl border border-almi-bg-peach bg-almi-paper p-4";
  const th = "px-4 py-3 font-semibold";
  const td = "px-4 py-3 text-almi-text-muted";

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Today", v: today },
            { label: "Last 7 days", v: week },
            { label: "Last 30 days", v: month },
            { label: "All time", v: allTime },
          ].map((s) => (
            <div key={s.label} className={card}>
              <p className="text-xs uppercase tracking-wide text-almi-text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-almi-ink">{formatCents(s.v.cents)}</p>
              <p className="text-xs text-almi-text-muted">
                {s.v.calls} call{s.v.calls === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
        {allTime.calls === 0 && (
          <p className="mt-3 rounded-xl border border-almi-bg-peach bg-almi-bg px-4 py-3 text-sm text-almi-text-muted">
            The ledger is empty. That means <strong>zero AI calls have ever been billed</strong> — not
            that the query failed.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-almi-ink">By feature</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-almi-bg-peach">
            <table className="w-full text-left text-sm">
              <thead className="bg-almi-bg text-xs uppercase tracking-wide text-almi-text-muted">
                <tr>
                  <th className={th}>Feature</th>
                  <th className={th}>Calls</th>
                  <th className={th}>Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-almi-bg-peach bg-almi-paper">
                {byFeature.length === 0 ? (
                  <tr>
                    <td className={td} colSpan={3}>
                      No calls recorded.
                    </td>
                  </tr>
                ) : (
                  byFeature.map((r) => (
                    <tr key={r.feature}>
                      <td className="px-4 py-3 text-almi-ink">{r.feature}</td>
                      <td className={td}>{r._count._all}</td>
                      <td className="px-4 py-3 font-semibold text-almi-ink">
                        {formatCents(r._sum.costCents ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-almi-ink">By model</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-almi-bg-peach">
            <table className="w-full text-left text-sm">
              <thead className="bg-almi-bg text-xs uppercase tracking-wide text-almi-text-muted">
                <tr>
                  <th className={th}>Model</th>
                  <th className={th}>Calls</th>
                  <th className={th}>Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-almi-bg-peach bg-almi-paper">
                {byModel.length === 0 ? (
                  <tr>
                    <td className={td} colSpan={3}>
                      No calls recorded.
                    </td>
                  </tr>
                ) : (
                  byModel.map((r) => (
                    <tr key={r.model}>
                      <td className="px-4 py-3 text-almi-ink">{r.model}</td>
                      <td className={td}>{r._count._all}</td>
                      <td className="px-4 py-3 font-semibold text-almi-ink">
                        {formatCents(r._sum.costCents ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-almi-ink">Top spenders</h2>
          <p className="text-xs text-almi-text-muted">
            Top {TOP_USERS} accounts by lifetime spend. System calls (seeding, the audio
            pre-render) carry no user and are excluded.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-almi-bg-peach">
          <table className="w-full text-left text-sm">
            <thead className="bg-almi-bg text-xs uppercase tracking-wide text-almi-text-muted">
              <tr>
                <th className={th}>Account</th>
                <th className={th}>Calls</th>
                <th className={th}>Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-almi-bg-peach bg-almi-paper">
              {topRaw.length === 0 ? (
                <tr>
                  <td className={td} colSpan={3}>
                    No user-attributed calls yet.
                  </td>
                </tr>
              ) : (
                topRaw.map((r) => (
                  <tr key={r.userId}>
                    <td className="px-4 py-3 text-almi-ink">
                      {/* A deleted user leaves ledger rows behind — show the id
                          rather than an empty cell, so spend is never orphaned. */}
                      {emailById.get(r.userId as string) ?? `(deleted user ${r.userId})`}
                    </td>
                    <td className={td}>{r._count._all}</td>
                    <td className="px-4 py-3 font-semibold text-almi-ink">
                      {formatCents(r._sum.costCents ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-almi-ink">Recent failures</h2>
          <p className="text-xs text-almi-text-muted">
            Recorded with zero cost, so they never show up in a total.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-almi-bg-peach">
          <table className="w-full text-left text-sm">
            <thead className="bg-almi-bg text-xs uppercase tracking-wide text-almi-text-muted">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Feature</th>
                <th className={th}>Model</th>
                <th className={th}>Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-almi-bg-peach bg-almi-paper">
              {failures.length === 0 ? (
                <tr>
                  <td className={td} colSpan={4}>
                    No failed calls recorded.
                  </td>
                </tr>
              ) : (
                failures.map((f) => (
                  <tr key={f.id}>
                    <td className={td}>{f.timestamp.toLocaleString()}</td>
                    <td className="px-4 py-3 text-almi-ink">{f.feature}</td>
                    <td className={td}>{f.model}</td>
                    <td className={td}>{f.errorMessage ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
