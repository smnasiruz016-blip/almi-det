import type { Metadata } from "next";
import { findCountry } from "@/lib/det/seo/almi-data-local";
import {
  findDetOrigin,
  getLocalizedOrigin,
  isDetOriginIndexable,
  detOriginQueries,
  detOriginAngle,
} from "@/lib/det/seo/origins";
import {
  DetMasterCrossLinks,
  DetMasterShamool,
  DetMasterDisclaimer,
  DetMasterCta,
  FaqJsonLd,
} from "@/components/det-master";

const SITE_URL = "https://almidet.almiworld.com";

export function DetOriginPage({ originSlug }: { originSlug: string }) {
  const origin = findDetOrigin(originSlug);
  const country = findCountry(originSlug);
  const name = origin?.name ?? country?.name ?? originSlug.replace(/-/g, " ");
  const flag = origin?.flag ?? country?.flag ?? "";
  const loc = getLocalizedOrigin(originSlug);
  const indexable = isDetOriginIndexable(originSlug);
  const queries = detOriginQueries(originSlug);
  const angle = origin ? detOriginAngle(origin) : null;

  const faqs = [
    { q: `How much does the Duolingo English Test cost from ${name}?`, a: `The DET costs about $70 worldwide — far less than IELTS (~$245). You take it online from home, so there is no test-centre travel from ${name}.` },
    { q: `Which universities accept the DET from ${name}?`, a: `Acceptance depends on the destination country and university, not your nationality. Use the requirements pages to see what each destination needs, then confirm with the specific programme.` },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <FaqJsonLd faqs={faqs} />
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-almi-teal">Prepare from your country</p>
        <h1 className="mt-1 text-3xl font-bold text-almi-ink">{flag} Duolingo English Test from {name}</h1>
        {angle && <p className="mt-3 text-almi-text"><span className="font-semibold text-almi-ink">{angle.heading}.</span> {angle.point}</p>}
      </header>

      {loc ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
            <h2 className="text-base font-semibold text-almi-ink">How students in {name} search</h2>
            <ul className="mt-2 space-y-1 text-sm text-almi-text">
              {queries.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
            <h2 className="text-base font-semibold text-almi-ink">From {name} — the essentials</h2>
            <dl className="mt-2 space-y-1 text-sm text-almi-text">
              <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Costs in</dt><dd>{loc.currency}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Credentials</dt><dd className="text-right">{origin?.credentialBody}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Funding to search</dt><dd className="text-right">{origin?.scholarshipCluster.join(", ")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Where students go</dt><dd className="text-right">{loc.topDestinations.join(", ")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Apply from</dt><dd className="text-right">{loc.cities.join(", ")}</dd></div>
            </dl>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
          <p className="text-almi-text">
            The Duolingo English Test costs about $70 and is taken online from home — the same from
            {" "}{name} as anywhere. We have not yet added {name}-specific localized guidance, so this
            page is general guidance and is not yet indexed.
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
      {!indexable && <p className="mt-6 text-center text-xs text-almi-text-muted">This page is honest guidance and is not yet indexed.</p>}
    </main>
  );
}

export function buildDetOriginMetadata(slug: string): Metadata {
  const origin = findDetOrigin(slug);
  const name = origin?.name ?? findCountry(slug)?.name ?? slug.replace(/-/g, " ");
  const indexable = isDetOriginIndexable(slug);
  const url = `${SITE_URL}/prepare/from-${slug}`;
  const title = `Duolingo English Test from ${name} — cost, universities, prep | AlmiDET`;
  const description = `Take the Duolingo English Test from ${name}: cost, which universities accept it, and how it compares with IELTS. Honest guidance on the 10–160 scale.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "article", siteName: "AlmiDET" },
    twitter: { card: "summary", title, description },
  };
}
