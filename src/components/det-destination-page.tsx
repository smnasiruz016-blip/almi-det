import type { Metadata } from "next";
import {
  lookupDetDestination,
  lookupAutoDestination,
  isDetDestinationIndexable,
  detDestinationName,
  detDestinationFlag,
} from "@/lib/det/seo/destinations";
import {
  DetMasterCrossLinks,
  DetMasterShamool,
  DetMasterDisclaimer,
  DetMasterCta,
  FaqJsonLd,
} from "@/components/det-master";

const SITE_URL = "https://almidet.almiworld.com";

function faqsFor(name: string): { q: string; a: string }[] {
  return [
    { q: `Is the Duolingo English Test accepted in ${name}?`, a: `The Duolingo English Test is accepted for admission by a range of institutions in ${name}. Each university — and often each programme — sets its own minimum score on the 10–160 scale, so confirm the figure on the official admissions page.` },
    { q: `What DET score do I need for ${name}?`, a: `There is no single national minimum. Requirements vary by university and programme; this page lists honest score bands by tier. Always confirm the current figure with your specific programme.` },
    { q: `Does the DET work for a ${name} student visa?`, a: `Admission and visa are separate. A test accepted for university admission is not automatically accepted for the visa. See the admission-versus-visa note on this page and confirm with the official authority.` },
  ];
}

export function DetDestinationPage({ destinationSlug }: { destinationSlug: string }) {
  const data = lookupDetDestination(destinationSlug);
  const auto = lookupAutoDestination(destinationSlug);
  const name = detDestinationName(destinationSlug);
  const flag = detDestinationFlag(destinationSlug);
  const indexable = isDetDestinationIndexable(destinationSlug);
  const faqs = faqsFor(name);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <FaqJsonLd faqs={faqs} />

      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-almi-teal">DET requirements</p>
        <h1 className="mt-1 text-3xl font-bold text-almi-ink">
          {flag} Duolingo English Test requirements for {name}
        </h1>
        {data && <p className="mt-3 text-almi-text">{data.acceptanceLead}</p>}
      </header>

      {data ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
              <div className="text-xs uppercase tracking-wide text-almi-text-muted">Institutions accepting the DET</div>
              <div className="mt-1 text-xl font-semibold text-almi-ink">{data.acceptanceCount}</div>
            </div>
            <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
              <div className="text-xs uppercase tracking-wide text-almi-text-muted">Score scale</div>
              <div className="mt-1 text-xl font-semibold text-almi-ink">10–160</div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-almi-ink">What score you need</h2>
            <p className="mt-2 text-almi-text">{data.study.requirement}</p>
            <p className="mt-2 text-almi-text">{data.study.body}</p>
          </section>

          {data.scoreTiers && data.scoreTiers.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-almi-ink">Score bands by tier</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-almi-bg-peach text-xs uppercase tracking-wide text-almi-text-muted">
                      <th className="py-2 pr-3 font-medium">Tier</th>
                      <th className="py-2 pr-3 font-medium">DET range</th>
                      <th className="py-2 pr-0 font-medium">Examples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scoreTiers.map((t) => (
                      <tr key={t.tier} className="border-b border-almi-bg-peach/60 text-almi-ink">
                        <td className="py-2 pr-3">{t.tier}</td>
                        <td className="py-2 pr-3 font-semibold">{t.range}</td>
                        <td className="py-2 pr-0 text-almi-text-muted">{t.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {data.namedUniversities && data.namedUniversities.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-almi-ink">Universities that accept the DET in {name}</h2>
              <ul className="mt-3 space-y-1 text-almi-text">
                {data.namedUniversities.map((u) => (
                  <li key={u.name} className="flex items-baseline justify-between gap-3 border-b border-almi-bg-peach/60 py-1">
                    <span>{u.name}</span>
                    {u.detScore && <span className="text-sm font-semibold text-almi-ink">{u.detScore}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Admission ≠ visa honesty box (required) */}
          <section className="mt-8 rounded-2xl border border-almi-accent/40 bg-almi-bg p-5">
            <h2 className="text-base font-semibold text-almi-ink">Admission is not the same as the visa</h2>
            <p className="mt-2 text-sm text-almi-text">{data.visaNote}</p>
          </section>

          {data.costAngle && (
            <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
              <h2 className="text-base font-semibold text-almi-ink">DET vs IELTS — cost</h2>
              <p className="mt-2 text-sm text-almi-text">{data.costAngle}</p>
            </section>
          )}

          <section className="mt-8 grid gap-3 sm:grid-cols-2">
            {data.acceptance.map((a) => (
              <div
                key={a.label}
                className={"rounded-xl border p-4 " + (a.warn ? "border-almi-accent/50 bg-almi-bg" : "border-almi-bg-peach bg-almi-paper")}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-almi-text-muted">{a.label}</div>
                <div className="mt-1 text-sm text-almi-text">{a.text}</div>
              </div>
            ))}
          </section>

          {data.sources.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-almi-ink">Sources</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {data.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} className="text-almi-teal underline" rel="nofollow noopener" target="_blank">{s.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : auto ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
              <div className="text-xs uppercase tracking-wide text-almi-text-muted">On Duolingo&apos;s accepting list</div>
              <div className="mt-1 text-xl font-semibold text-almi-ink">{auto.count} institutions &amp; programmes</div>
            </div>
            <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
              <div className="text-xs uppercase tracking-wide text-almi-text-muted">Score scale</div>
              <div className="mt-1 text-xl font-semibold text-almi-ink">10–160</div>
            </div>
          </section>
          <section className="mt-8">
            <h2 className="text-xl font-semibold text-almi-ink">The Duolingo English Test in {name}</h2>
            <p className="mt-2 text-almi-text">
              Around {auto.count} institutions and programmes associated with {name} accept the
              Duolingo English Test, per Duolingo&apos;s own accepting-institutions list. Scores run on
              the 10–160 scale; each university and programme sets its own minimum, so confirm the
              figure on the official admissions page.
            </p>
          </section>
          <section className="mt-6 rounded-2xl border border-almi-accent/40 bg-almi-bg p-5">
            <h2 className="text-base font-semibold text-almi-ink">Admission is not the same as the visa</h2>
            <p className="mt-2 text-sm text-almi-text">
              A test accepted for university admission is not automatically accepted for the student
              visa. Confirm the visa English requirement for {name} with the official immigration
              authority before you rely on a DET score.
            </p>
          </section>
          <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
            <h2 className="text-base font-semibold text-almi-ink">DET vs IELTS — cost</h2>
            <p className="mt-2 text-sm text-almi-text">
              At about $70 the DET is taken online from home — far cheaper than IELTS (~$245) and with
              no test-centre travel.
            </p>
          </section>
        </>
      ) : (
        <section className="mt-8 rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
          <p className="text-almi-text">
            The Duolingo English Test is accepted for admission by institutions in many countries.
            We have not yet verified {name}-specific acceptance figures, named universities and score
            bands, so this page is honest general guidance and is not yet indexed. Confirm the current
            requirement on your university&apos;s official admissions page.
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-almi-ink">Common questions</h2>
        <dl className="mt-3 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-almi-ink">{f.q}</dt>
              <dd className="mt-1 text-sm text-almi-text">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DetMasterCrossLinks name={name} />
      <DetMasterCta />
      <DetMasterShamool />
      <DetMasterDisclaimer />

      {!indexable && (
        <p className="mt-6 text-center text-xs text-almi-text-muted">
          This page is honest guidance and is not yet indexed.
        </p>
      )}
    </main>
  );
}

export function buildDetDestinationMetadata(slug: string): Metadata {
  const name = detDestinationName(slug);
  const indexable = isDetDestinationIndexable(slug);
  const url = `${SITE_URL}/requirements/${slug}`;
  const title = `Duolingo English Test requirements for ${name} (2026) | AlmiDET`;
  const description = `DET score requirements, accepting universities and the admission-versus-visa picture for ${name}, on the 10–160 scale. Honest guidance — confirm on the official page.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "article", siteName: "AlmiDET" },
    twitter: { card: "summary", title, description },
  };
}
