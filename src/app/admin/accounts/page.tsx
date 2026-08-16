// Accounts — the full user list, and the surface where comp is ACTED on.
// /admin/comp-accounts remains the grants audit trail (active + expired history
// with reason and granter), which this table deliberately does not duplicate.
//
// THE ONE RULE THIS PAGE MUST NOT BREAK: plan status is decided in exactly one
// place. The badge comes from isComped()/isProActive() in lib/billing/plans.ts,
// and the SQL status filter is built from the SAME predicates and the exported
// ACTIVE_STATUSES — never a local classifyPlan() or a hand-copied
// ["active","trialing"]. A second copy of the rule is how the admin comes to
// show "Pro" while the product refuses access, with nothing failing loudly.
//
// Note that "status IN (active, trialing)" alone is NOT the rule: isProActive()
// also requires subscriptionCurrentPeriodEnd in the future, so PRO_WHERE mirrors
// both clauses. The stat tiles are counted with these very expressions, so the
// tiles and the filtered table cannot disagree.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/founder";
import {
  ACTIVE_STATUSES,
  isComped,
  isProActive,
  getCompProDaysRemaining,
} from "@/lib/billing/plans";
import { AccountCompControls } from "./AccountCompControls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accounts — Admin",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

type Status = "all" | "free" | "pro" | "comp";
const STATUSES: Status[] = ["all", "free", "pro", "comp"];

// ---- SQL predicates, mirroring lib/billing/plans.ts exactly ----
const compActive = (now: Date): Prisma.UserWhereInput => ({ compProUntil: { gt: now } });
const notComped = (now: Date): Prisma.UserWhereInput => ({
  OR: [{ compProUntil: null }, { compProUntil: { lte: now } }],
});
/** The subscription half of isProActive(): an active status AND a period that
 *  has not ended. Both clauses, or this disagrees with the runtime predicate. */
const subActive = (now: Date): Prisma.UserWhereInput => ({
  subscriptionStatus: { in: [...ACTIVE_STATUSES] },
  subscriptionCurrentPeriodEnd: { gt: now },
});

/**
 * The NEGATION of subActive, written out clause by clause.
 *
 * It cannot be expressed as `{ NOT: subActive }`. That compiles to
 * `NOT (status IN (...) AND periodEnd > now)`, and SQL's three-valued logic
 * makes the whole expression NULL — not TRUE — for any row where
 * subscriptionStatus IS NULL. WHERE keeps only TRUE, so every user who never
 * subscribed silently disappeared from the Free count and the Free filter.
 * Measured on production: Total 3, Free 1, the two never-subscribed users lost.
 *
 * Spelling out the four ways isProActive() can be false keeps NULL handling
 * explicit instead of leaving it to the database's idea of unknown.
 */
const notSubActive = (now: Date): Prisma.UserWhereInput => ({
  OR: [
    { subscriptionStatus: null },
    { NOT: { subscriptionStatus: { in: [...ACTIVE_STATUSES] } } },
    { subscriptionCurrentPeriodEnd: null },
    { subscriptionCurrentPeriodEnd: { lte: now } },
  ],
});

function statusWhere(status: Status, now: Date): Prisma.UserWhereInput | undefined {
  switch (status) {
    case "comp":
      return compActive(now);
    // Comp short-circuits isProActive(), so a comped user is counted as Comp and
    // never also as Pro — the tiles therefore sum to the total exactly.
    case "pro":
      return { AND: [notComped(now), subActive(now)] };
    case "free":
      return { AND: [notComped(now), notSubActive(now)] };
    default:
      return undefined;
  }
}

/** Newest session's expiry minus the session lifetime — i.e. when that session
 *  was created. That is a SIGN-IN, so the column says sign-in; calling it "last
 *  active" would claim something this value cannot support. */
function lastSignIn(sessionExpires: Date | undefined, fallback: Date): Date {
  if (!sessionExpires) return fallback;
  const derived = new Date(sessionExpires.getTime() - SESSION_DURATION_MS);
  return derived.getTime() > fallback.getTime() ? derived : fallback;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  // Re-gated independently. The layout also gates; this is defence in depth, not
  // duplication — a page must not rely on an ancestor for its own authorisation.
  const user = await requireUser();
  if (!isAdmin(user.email)) redirect("/");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status: Status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const now = new Date();
  const search: Prisma.UserWhereInput | undefined = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const where: Prisma.UserWhereInput = {
    AND: [statusWhere(status, now), search].filter(Boolean) as Prisma.UserWhereInput[],
  };

  const [rows, matching, total, compCount, proCount, freeCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        compProUntil: true,
        sessions: { orderBy: { expiresAt: "desc" }, take: 1, select: { expiresAt: true } },
      },
    }),
    prisma.user.count({ where }),
    // Tiles describe the whole user base, not the current query.
    prisma.user.count(),
    prisma.user.count({ where: compActive(now) }),
    prisma.user.count({ where: statusWhere("pro", now) }),
    prisma.user.count({ where: statusWhere("free", now) }),
  ]);

  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    for (const [k, v] of Object.entries(over)) {
      if (v === "" || v === "all") p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/admin/accounts?${s}` : "/admin/accounts";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: total },
          { label: "Free", value: freeCount },
          { label: "Pro", value: proCount },
          { label: "Comp", value: compCount },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-4">
            <p className="text-xs uppercase tracking-wide text-almi-text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-almi-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Plain GET form: linkable, survives reload, needs no client JS. */}
      <form method="GET" action="/admin/accounts" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="block text-xs font-semibold uppercase tracking-wide text-almi-text-muted">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Email or name"
            className="mt-1 w-full rounded-xl border border-almi-ink/15 bg-almi-bg px-3 py-2 text-sm text-almi-ink focus:border-almi-coral focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-semibold uppercase tracking-wide text-almi-text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 rounded-xl border border-almi-ink/15 bg-almi-bg px-3 py-2 text-sm text-almi-ink focus:border-almi-coral focus:outline-none"
          >
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="comp">Comp</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-full bg-almi-coral px-5 py-2 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep"
        >
          Apply
        </button>
        {(q || status !== "all") && (
          <Link href="/admin/accounts" className="text-sm font-medium text-almi-coral hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div>
        <p className="mb-3 text-xs text-almi-text-muted">
          {matching === 0
            ? "No accounts match."
            : `${matching} account${matching === 1 ? "" : "s"} match — showing ${
                (page - 1) * PAGE_SIZE + 1
              }–${Math.min(page * PAGE_SIZE, matching)}.`}
        </p>

        <div className="overflow-x-auto rounded-2xl border border-almi-bg-peach">
          <table className="w-full text-left text-sm">
            <thead className="bg-almi-bg text-xs uppercase tracking-wide text-almi-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Last sign-in</th>
                <th className="px-4 py-3 font-semibold">Comp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-almi-bg-peach bg-almi-paper">
              {rows.map((u) => {
                // Badge from the shared predicates — no local classification.
                const comped = isComped(u);
                const pro = isProActive(u);
                const badge = comped
                  ? { label: "🎁 Comp", cls: "bg-almi-gold/20 text-almi-gold-deep" }
                  : pro
                    ? { label: "Pro", cls: "bg-almi-teal/15 text-almi-teal" }
                    : { label: "Free", cls: "bg-almi-bg-peach text-almi-text-muted" };
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-almi-ink">{u.email}</td>
                    <td className="px-4 py-3 text-almi-text-muted">{u.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-almi-text-muted">
                      {u.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-almi-text-muted">
                      {lastSignIn(u.sessions[0]?.expiresAt, u.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <AccountCompControls
                        userId={u.id}
                        email={u.email}
                        comped={comped}
                        daysRemaining={getCompProDaysRemaining(u)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={qs({ page: page - 1 })} className="font-medium text-almi-coral hover:underline">
                ← Previous
              </Link>
            ) : (
              <span className="text-almi-text-muted">← Previous</span>
            )}
            <span className="text-almi-text-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={qs({ page: page + 1 })} className="font-medium text-almi-coral hover:underline">
                Next →
              </Link>
            ) : (
              <span className="text-almi-text-muted">Next →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
