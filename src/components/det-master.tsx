// Shared "master" blocks rendered at the bottom of every DET SEO landing page —
// the common chrome (cross-product links, Shamool pledge, honest disclaimer,
// practice CTA) plus the FAQ JSON-LD helper. AlmiDET sunrise palette
// (coral + amber-honey #F4A340) — NOT a dark mock.

import Link from "next/link";

export function DetMasterCrossLinks({ name }: { name?: string }) {
  const suffix = name ? ` for ${name}` : "";
  return (
    <section className="mt-10 rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
      <h2 className="text-lg font-semibold text-almi-ink">Plan the rest of your move{suffix}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <a href="https://almistudy.almiworld.com" className="rounded-xl border border-almi-bg-peach p-4 transition-colors hover:border-almi-coral">
          <div className="font-semibold text-almi-ink">AlmiStudy</div>
          <div className="mt-1 text-sm text-almi-text-muted">Find universities and the subjects they teach, by country.</div>
        </a>
        <a href="https://almiprep.almiworld.com" className="rounded-xl border border-almi-bg-peach p-4 transition-colors hover:border-almi-coral">
          <div className="font-semibold text-almi-ink">AlmiPrep</div>
          <div className="mt-1 text-sm text-almi-text-muted">Preparing for IELTS instead? Practice all four skills with honest feedback.</div>
        </a>
        <Link href="/practice" className="rounded-xl border border-almi-bg-peach p-4 transition-colors hover:border-almi-coral">
          <div className="font-semibold text-almi-ink">Practice the DET</div>
          <div className="mt-1 text-sm text-almi-text-muted">Try AlmiDET practice tasks on the real 10–160 scale with honest AI feedback.</div>
        </Link>
      </div>
    </section>
  );
}

export function DetMasterShamool() {
  return (
    <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-bg p-6">
      <h2 className="text-base font-semibold text-almi-ink">The Shamool pledge</h2>
      <p className="mt-2 text-sm text-almi-text">
        AlmiDET is part of the AlmiWorld family. A share of what the family earns goes to the
        Shamool Foundation to support students who cannot afford fees and tests — so the work you
        do here helps fund a place for someone else.
      </p>
    </section>
  );
}

export function DetMasterDisclaimer() {
  return (
    <p className="mt-6 text-center text-xs text-almi-text-muted">
      AlmiDET is independent and not affiliated with, endorsed by, or connected to Duolingo. All
      practice material is original and never copied from the Duolingo English Test. Acceptance
      figures and score bands change — always confirm the current requirement on the official
      university or government page before you rely on it.
    </p>
  );
}

export function DetMasterCta() {
  return (
    <section className="mt-6 rounded-2xl border border-almi-coral/30 bg-almi-paper p-6 text-center">
      <h2 className="text-lg font-semibold text-almi-ink">Practice on the real 10–160 scale</h2>
      <p className="mt-1 text-sm text-almi-text-muted">Honest AI feedback, no inflated numbers.</p>
      <Link
        href="/practice"
        className="mt-4 inline-flex items-center rounded-full bg-almi-coral px-6 py-2.5 text-sm font-semibold text-almi-ink transition-colors hover:bg-almi-coral-deep"
      >
        Start practising
      </Link>
    </section>
  );
}

/** FAQPage JSON-LD — pass a list of {q,a}. Render inside the page. */
export function FaqJsonLd({ faqs }: { faqs: { q: string; a: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}
