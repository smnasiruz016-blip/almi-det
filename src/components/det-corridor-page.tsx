import type { Metadata } from "next";
import {
  lookupDetDestination,
  isDetDestinationIndexable,
  detDestinationName,
  detDestinationFlag,
} from "@/lib/det/seo/destinations";
import { findDetOrigin, getLocalizedOrigin } from "@/lib/det/seo/origins";
import {
  DetMasterCrossLinks,
  DetMasterShamool,
  DetMasterDisclaimer,
  DetMasterCta,
  FaqJsonLd,
} from "@/components/det-master";

const SITE_URL = "https://almidet.almiworld.com";

/** Indexable only when BOTH the destination is verified AND the origin carries
 *  real localized substance; otherwise it canonicalises up to the destination
 *  master and stays noindex. */
export function corridorIndexable(destSlug: string, originSlug: string): boolean {
  return isDetDestinationIndexable(destSlug) && Boolean(getLocalizedOrigin(originSlug));
}

export function DetCorridorPage({ destinationSlug, originSlug }: { destinationSlug: string; originSlug: string }) {
  const data = lookupDetDestination(destinationSlug);
  const destName = detDestinationName(destinationSlug);
  const destFlag = detDestinationFlag(destinationSlug);
  const origin = findDetOrigin(originSlug);
  const loc = getLocalizedOrigin(originSlug);
  const originName = origin?.name ?? originSlug.replace(/-/g, " ");
  const indexable = corridorIndexable(destinationSlug, originSlug);

  const faqs = [
    { q: `Can students from ${originName} use the Duolingo English Test for ${destName}?`, a: `DET acceptance depends on the ${destName} university, not your nationality. This page pairs ${destName}'s requirements with practical notes for applicants from ${originName}.` },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <FaqJsonLd faqs={faqs} />
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-almi-teal">Your corridor</p>
        <h1 className="mt-1 text-3xl font-bold text-almi-ink">
          {destFlag} Duolingo English Test for {destName} — from {originName}
        </h1>
        {data && <p className="mt-3 text-almi-text">{data.acceptanceLead}</p>}
      </header>

      {data && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-almi-ink">What {destName} asks for</h2>
          <p className="mt-2 text-almi-text">{data.study.requirement}</p>
          <div className="mt-4 rounded-2xl border border-almi-accent/40 bg-almi-bg p-5">
            <h3 className="text-base font-semibold text-almi-ink">Admission is not the same as the visa</h3>
            <p className="mt-2 text-sm text-almi-text">{data.visaNote}</p>
          </div>
        </section>
      )}

      {loc && (
        <section className="mt-8 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
          <h2 className="text-base font-semibold text-almi-ink">From {originName} — the essentials</h2>
          <dl className="mt-2 space-y-1 text-sm text-almi-text">
            <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Costs in</dt><dd>{loc.currency}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Where students go</dt><dd className="text-right">{loc.topDestinations.join(", ")}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Apply from</dt><dd className="text-right">{loc.cities.join(", ")}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-almi-text-muted">
            At about $70 the DET is taken online from {originName} — no test-centre travel, and far
            cheaper than IELTS.
          </p>
        </section>
      )}

      {!data && (
        <section className="mt-8 rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
          <p className="text-almi-text">
            We have not yet verified {destName}-specific DET figures, so this corridor is honest
            general guidance and is not yet indexed. Confirm the requirement on the official page.
          </p>
        </section>
      )}

      <DetMasterCrossLinks name={destName} />
      <DetMasterCta />
      <DetMasterShamool />
      <DetMasterDisclaimer />
      {!indexable && (
        <p className="mt-6 text-center text-xs text-almi-text-muted">
          This corridor points to the {destName} requirements page and is not separately indexed.
        </p>
      )}
    </main>
  );
}

export function buildDetCorridorMetadata(destinationSlug: string, originSlug: string): Metadata {
  const destName = detDestinationName(destinationSlug);
  const origin = findDetOrigin(originSlug);
  const originName = origin?.name ?? originSlug.replace(/-/g, " ");
  const indexable = corridorIndexable(destinationSlug, originSlug);
  const selfUrl = `${SITE_URL}/requirements/${destinationSlug}/from-${originSlug}`;
  const destUrl = `${SITE_URL}/requirements/${destinationSlug}`;
  const title = `DET for ${destName} from ${originName} (2026) | AlmiDET`;
  const description = `Duolingo English Test requirements for ${destName}, with practical notes for applicants from ${originName}. Honest guidance on the 10–160 scale.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: indexable ? selfUrl : destUrl },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: selfUrl, type: "article", siteName: "AlmiDET" },
    twitter: { card: "summary", title, description },
  };
}
