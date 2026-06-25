import type { Metadata } from "next";
import { detDestinationName } from "@/lib/det/seo/destinations";
import {
  DetMasterCrossLinks,
  DetMasterShamool,
  DetMasterDisclaimer,
} from "@/components/det-master";

const SITE_URL = "https://almidet.almiworld.com";

// University layer (Matrix D/E) — scaffolded but GATE-CLOSED. Per-university DET
// acceptance is not yet normalised (Duolingo cross-reference is a later phase),
// so every page here is NOINDEX and canonicalises up to the destination master.
// No per-university scores are shown — never fabricated.

function titleCase(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Props = {
  destinationSlug: string;
  universitySlug: string;
  subject?: string;
  originSlug?: string;
};

export function DetUniversityPage({ destinationSlug, universitySlug, subject, originSlug }: Props) {
  const destName = detDestinationName(destinationSlug);
  const uniName = titleCase(universitySlug);
  const subjectName = subject ? titleCase(subject) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-almi-teal">University requirements</p>
        <h1 className="mt-1 text-2xl font-bold text-almi-ink">
          {uniName}{subjectName ? ` — ${subjectName}` : ""} · Duolingo English Test
        </h1>
      </header>

      <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
        <p className="text-almi-text">
          We are verifying per-university Duolingo English Test acceptance for institutions in {destName}.
          Until {uniName}&apos;s specific requirement is confirmed against the official source, this page
          stays honest general guidance and is not indexed — we never publish a per-university score we
          have not verified.
        </p>
        <p className="mt-3 text-sm text-almi-text-muted">
          For verified country-level guidance, see the{" "}
          <a href={`/requirements/${destinationSlug}`} className="text-almi-teal underline">
            {destName} DET requirements page
          </a>
          {originSlug ? ", and confirm the figure with the university directly." : "."}
        </p>
      </section>

      <DetMasterCrossLinks name={destName} />
      <DetMasterShamool />
      <DetMasterDisclaimer />
    </main>
  );
}

export function buildDetUniversityMetadata(destinationSlug: string): Metadata {
  // Always noindex + canonical-up to the destination master while gate-closed.
  const destName = detDestinationName(destinationSlug);
  const destUrl = `${SITE_URL}/requirements/${destinationSlug}`;
  return {
    title: { absolute: `University DET requirements in ${destName} | AlmiDET` },
    description: `Per-university Duolingo English Test acceptance in ${destName} — verification in progress.`,
    alternates: { canonical: destUrl },
    robots: { index: false, follow: true },
  };
}
