import type { Metadata } from "next";
import Link from "next/link";
import { DET_TASKS, TASK_ORDER } from "@/lib/det/registry";
import { SUBSCORE_LABEL } from "@/lib/det/types";

// Homepage self-brands. `absolute` opts out of the root layout's title
// template so the brand appears exactly once.
export const metadata: Metadata = {
  title: {
    absolute: "Duolingo English Test Practice with Honest AI Feedback | AlmiDET",
  },
  description:
    "Practise the Duolingo English Test on the real 10–160 scale, with honest AI feedback and a clear estimate of your Literacy, Comprehension, Conversation and Production. Original material, never copied from Duolingo. $12/month, 7-day free trial.",
  openGraph: {
    title: "AlmiDET — honest Duolingo English Test practice",
    description:
      "Original practice tasks on the real 10–160 scale, with honest AI feedback and subscore estimates shown as ranges, not inflated numbers.",
  },
};

const PROMISES = [
  {
    title: "Built for the real DET",
    detail:
      "Practice tasks that mirror the current Duolingo English Test — Read and Select, Listen and Type, Write About the Photo and more — on the real 10–160 scale.",
  },
  {
    title: "Honest estimates, shown as ranges",
    detail:
      "We never invent a single DET number. You see each subscore as a range, with the uncertainty shown — because honest prep means telling you what we don't know.",
  },
  {
    title: "Original material",
    detail: "Every word list, prompt and scene is written from scratch — never copied from Duolingo.",
  },
  {
    title: "Feedback you can act on",
    detail:
      "AI feedback on your writing and speaking points to what to fix next — constructive and honest, never inflated.",
  },
] as const;

const PRICING_LINES = [
  "Honest AI feedback on Write and Speak About the Photo",
  "Auto-marked Read and Select and Listen and Type",
  "Subscore estimates on the 10–160 scale, shown as ranges",
  "Original practice material — never copied from Duolingo",
  "$12/month with a 7-day free trial, cancel anytime",
] as const;

const FAQ = [
  {
    q: "How is the Duolingo English Test scored?",
    a: "On a 10–160 scale in steps of 5, with four skill scores and four integrated subscores — Literacy, Comprehension, Conversation and Production. AlmiDET estimates those subscores from your practice and shows each as a range.",
  },
  {
    q: "Why don't you show a single overall DET score?",
    a: "Because the real overall is a proprietary adaptive calculation we can't reproduce honestly. Inventing one would be misleading, so we show honest per-subscore ranges and a readiness band instead.",
  },
  {
    q: "Is AlmiDET practice copied from Duolingo?",
    a: "No. Every task — word lists, prompts and scenes — is original, written from scratch to mirror the real task types. We never copy or reproduce Duolingo's material.",
  },
  {
    q: "Is the Duolingo English Test accepted everywhere?",
    a: "It is widely accepted for university admission, including many top US universities. It is often NOT accepted for visa or immigration English proof — those usually require IELTS or PTE. Always check what your specific university and visa route require.",
  },
  {
    q: "Is the practice adaptive?",
    a: "Yes. Objective tasks run as short adaptive sets — as you answer, the difficulty adjusts to your level. This is our own difficulty-pool adaptivity to make practice efficient; it does not reproduce Duolingo's scoring engine.",
  },
  {
    q: "Is my AlmiDET score my real DET result?",
    a: "No. It's a practice estimate to guide your prep. Your real score comes only from an official Duolingo English Test.",
  },
  {
    q: "How much does AlmiDET cost?",
    a: "$12 per month with a 7-day free trial, monthly only, cancel anytime. No hidden fees.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// Illustrative sample — clearly labelled, never a real user, never a real DET score.
const SAMPLE = [
  { name: "Literacy", range: "95–115" },
  { name: "Comprehension", range: "100–120" },
  { name: "Conversation", range: "80–110" },
  { name: "Production", range: "90–115" },
];

function SubscoreMockup() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-3xl border border-almi-bg-peach bg-almi-paper p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-almi-text-muted">Sample estimate</p>
          <span className="rounded-full bg-almi-bg-peach px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-almi-ink">Sample</span>
        </div>
        <div className="mt-4 rounded-2xl bg-almi-accent/10 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-almi-text-muted">Readiness</p>
          <p className="mt-0.5 text-2xl font-bold text-almi-accent-deep">Approaching readiness</p>
        </div>
        <ul className="mt-4 space-y-2.5">
          {SAMPLE.map((s) => (
            <li key={s.name} className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-almi-ink">{s.name}</span>
              <span className="font-semibold text-almi-coral-deep">{s.range}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl border border-almi-bg-peach bg-almi-bg px-4 py-3">
          <p className="text-xs text-almi-text-muted">
            We show a range, not a single number — honest prep means showing the uncertainty.
          </p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-almi-text-muted">Illustrative example — not a real score.</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-almi-bg text-almi-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-almi-bg via-almi-bg to-almi-bg-peach px-6 pt-16 pb-20 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 z-0 h-96 w-96 rounded-full bg-almi-accent/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 z-0 h-80 w-80 rounded-full bg-almi-coral/10 blur-3xl" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-almi-accent-deep">AlmiDET · Duolingo English Test</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] text-almi-ink sm:text-5xl">
              Practise the Duolingo English Test with <span className="text-almi-coral">honest AI feedback.</span>
            </h1>
            <p className="mt-5 text-lg text-almi-text">
              Original practice tasks on the real 10–160 scale, with a clear estimate of where your Literacy,
              Comprehension, Conversation and Production sit — so you know what to work on next.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-almi-coral/30"
              >
                Practise free
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-almi-coral hover:underline"
              >
                Already have an account? Log in →
              </Link>
            </div>
            <p className="mt-4 text-sm text-almi-text-muted">
              $12/month, 7-day free trial, cancel anytime · Original material, never copied from Duolingo · Part of the AlmiWorld family
            </p>
          </div>
          <SubscoreMockup />
        </div>
      </section>

      {/* Honest hook */}
      <section className="border-t border-almi-bg-peach bg-almi-paper px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-semibold text-almi-ink">An honest estimate, not a fake score</h2>
          <p className="mt-5 text-base text-almi-text">
            The Duolingo English Test reports a 10–160 score and four integrated subscores from an adaptive,
            AI-graded test. The real overall is a proprietary calculation — so anyone promising you a precise
            number from practice is guessing. AlmiDET does the honest thing instead: we estimate each subscore
            from your practice and show it as a range, with the uncertainty visible.
          </p>
          <p className="mt-4 text-base text-almi-text">
            One principle runs through it: <strong className="text-almi-ink">tell you the truth.</strong> Honest
            feedback, original material, and a clear read on what to work on next.
          </p>
        </div>
      </section>

      {/* Task cards */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-semibold text-almi-ink">Practise the real DET task types</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base text-almi-text-muted">
            Objective tasks run as adaptive sets that adjust to your level; writing and speaking get honest
            AI feedback. Each informs the subscores it touches.
          </p>
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {TASK_ORDER.map((t) => {
              const def = DET_TASKS[t];
              const subs = def.feedsSubscores.map((s) => SUBSCORE_LABEL[s]).join(" + ");
              return (
                <li key={t} className="flex h-full flex-col rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold text-almi-ink">{def.label}</h3>
                    <span className="text-xs text-almi-text-muted">
                      {def.live ? (def.scoringMode === "AI" ? "AI feedback" : "Auto-marked") : "Coming soon"}
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-sm text-almi-text">{def.blurb}</p>
                  <span className="mt-3 text-xs text-almi-text-muted">Informs: {subs}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Why honest */}
      <section className="border-t border-almi-bg-peach bg-almi-bg-peach/40 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-semibold text-almi-ink">Honest scoring on the real scale</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {PROMISES.map((p) => (
              <li key={p.title} className="flex items-start gap-3 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
                <span aria-hidden className="mt-0.5 flex-shrink-0 select-none font-bold text-almi-teal">✓</span>
                <p className="text-sm text-almi-text">
                  <span className="font-semibold text-almi-ink">{p.title}</span>
                  {" — "}
                  {p.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-almi-ink">Simple, honest pricing</h2>
          <p className="mt-3 text-xl font-semibold text-almi-ink">$12/month — 7-day free trial, cancel anytime.</p>
          <ul className="mx-auto mt-6 max-w-xl space-y-2 text-left text-sm text-almi-text">
            {PRICING_LINES.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 flex-shrink-0 select-none font-bold text-almi-teal">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
            >
              Practise free
            </Link>
          </div>
          <p className="mt-4 text-sm text-almi-text-muted">
            <Link href="/pricing" className="underline hover:text-almi-ink">See full pricing</Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-almi-bg-peach bg-almi-paper px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-semibold text-almi-ink">Common questions</h2>
          <dl className="mt-10 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-6">
                <dt className="text-lg font-semibold text-almi-ink">{f.q}</dt>
                <dd className="mt-2 text-sm text-almi-text">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-almi-ink">Practise honestly. Walk in ready.</h2>
          <p className="mt-3 text-base text-almi-text">
            Real DET task types, honest subscore estimates, original material — for $12/month with a 7-day free
            trial.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
            >
              Practise free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
