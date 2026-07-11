// Account page — slim version: plan + email status only. A "recent attempts"
// block can be added back here later (the AlmiPrep account page is the template).

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getUserPlan,
  PLAN_DISPLAY_NAME,
  isProActive,
  isEmailVerified,
} from "@/lib/billing/plans";
import { ResendVerificationButton } from "@/components/ResendVerificationButton";
import { ReviewCard } from "@/components/reviews/ReviewCard";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; upgraded?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const plan = getUserPlan(user);
  const proActive = isProActive(user);
  const verified = isEmailVerified(user);

  return (
    <div className="space-y-8">
      {params.welcome && (
        <div className="rounded-xl border border-almi-teal/30 bg-almi-teal/10 px-4 py-3 text-sm text-almi-ink">
          Welcome, {user.name ?? "friend"}. Check your inbox for the verification link.
        </div>
      )}
      {params.upgraded && (
        <div className="rounded-xl border border-almi-teal/30 bg-almi-teal/10 px-4 py-3 text-sm text-almi-ink">
          Subscription active. Your 7-day trial has begun.
        </div>
      )}

      <header>
        <h1 className="text-3xl font-semibold text-almi-ink">Your account</h1>
        <p className="mt-1 text-sm text-almi-text-muted">{user.email}</p>
      </header>

      <section className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-almi-ink">Plan</h2>
        <p className="mt-1 text-sm text-almi-text">
          <span className="font-semibold">{PLAN_DISPLAY_NAME[plan]}</span>
          {user.subscriptionStatus && (
            <span className="ml-2 rounded-md bg-almi-bg-peach px-2 py-0.5 text-xs uppercase tracking-wide text-almi-ink">
              {user.subscriptionStatus}
            </span>
          )}
        </p>
        {user.subscriptionCurrentPeriodEnd && (
          <p className="mt-2 text-xs text-almi-text-muted">
            {user.subscriptionCancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
            {new Date(user.subscriptionCurrentPeriodEnd).toLocaleDateString()}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {proActive ? (
            <form action="/api/billing/portal" method="POST">
              <button
                type="submit"
                className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-almi-ink/15 bg-almi-paper px-4 py-2 text-sm font-semibold text-almi-ink hover:border-almi-coral"
              >
                Manage subscription
              </button>
            </form>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex min-h-[40px] items-center justify-center bg-almi-coral px-4 py-2 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep"
              style={{ borderRadius: 6 }}
            >
              View plans
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-almi-ink">Email</h2>
        <p className="mt-1 text-sm text-almi-text">
          {user.email}{" "}
          {verified ? (
            <span className="ml-2 rounded-md bg-almi-teal/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-almi-teal">
              Verified
            </span>
          ) : (
            <span className="ml-2 rounded-md bg-almi-coral/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-almi-coral-deep">
              Not verified
            </span>
          )}
        </p>
        {!verified && (
          <>
            <p className="mt-3 text-sm text-almi-text-muted">
              Didn&apos;t get the link? Resend it — paid features stay locked until your email is verified.
            </p>
            <ResendVerificationButton email={user.email} />
          </>
        )}
      </section>

      <section className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-6 text-center">
        <p className="text-sm text-almi-text">Ready to practise for the Duolingo English Test?</p>
        <Link
          href="/practice"
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep"
        >
          Choose a task →
        </Link>
      </section>

      <ReviewCard />
    </div>
  );
}
