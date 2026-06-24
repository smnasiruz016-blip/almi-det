// Full-length mock start page. One item per task type across all four skills,
// aggregated into the four honest subscore ranges + readiness band. The mock
// includes AI tasks, so it needs a subscription.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasPaidAccess } from "@/lib/billing/plans";
import { startSession } from "@/lib/det/session";

async function startMockAction() {
  "use server";
  const user = await requireUser();
  if (!hasPaidAccess(user)) redirect("/pricing");
  const id = await startSession({ userId: user.id, mode: "MOCK" });
  if (!id) redirect("/practice?mockempty=1");
  redirect(`/practice/session/${id}`);
}

export default async function MockStartPage() {
  const user = await requireUser();
  const needsPaid = !hasPaidAccess(user);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">AlmiDET</p>
      <h1 className="text-3xl font-semibold text-almi-ink">Full-length practice</h1>
      <p className="text-base text-almi-text">
        A full-length practice run across all four skills — Read and Select, Listen and Type, Write
        About the Photo and Speak About the Photo — in one sitting. The real test is adaptive; this
        practice uses fixed task sets so you can rehearse the format end to end.
      </p>

      <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5 text-sm text-almi-text">
        <p>
          At the end you get the four honest subscore ranges — Literacy, Comprehension, Conversation
          and Production — on the 10–160 scale, plus a readiness band. No single overall number: that
          is Duolingo&apos;s to calculate, not ours.
        </p>
      </div>

      {needsPaid ? (
        <div className="rounded-xl border border-almi-accent/40 bg-almi-accent/10 px-4 py-3 text-sm text-almi-ink">
          The full-length practice includes AI feedback and is part of a subscription.{" "}
          <a href="/pricing" className="font-semibold underline">
            See plans
          </a>
          .
        </div>
      ) : (
        <form action={startMockAction}>
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
          >
            Begin full-length practice →
          </button>
        </form>
      )}

      <p className="text-xs text-almi-text-muted">
        Original to AlmiDET — never copied from Duolingo. Results are a practice estimate, not an
        official Duolingo English Test result.
      </p>
    </div>
  );
}
