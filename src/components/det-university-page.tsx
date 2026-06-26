import type { Metadata } from "next";
import { lookupDetDestination, detDestinationName } from "@/lib/det/seo/destinations";
import { findDetUni, isDetUniIndexable, isDetUniSubjectIndexable } from "@/lib/det/seo/universities";
import { findDetOrigin, getLocalizedOrigin, isDetOriginIndexable } from "@/lib/det/seo/origins";
import {
  DetMasterCrossLinks,
  DetMasterShamool,
  DetMasterDisclaimer,
  DetMasterCta,
  FaqJsonLd,
} from "@/components/det-master";

const SITE_URL = "https://almidet.almiworld.com";

const SUBJECT_LABEL: Record<string, string> = {
  "agriculture-environment": "Agriculture & Environment",
  "architecture-design": "Architecture & Design",
  "arts-humanities": "Arts & Humanities",
  "business-management": "Business & Management",
  "computer-science-it": "Computer Science & IT",
  education: "Education",
  "engineering-technology": "Engineering & Technology",
  law: "Law",
  "mathematics-statistics": "Mathematics & Statistics",
  "medicine-health-sciences": "Medicine & Health Sciences",
  "natural-sciences": "Natural Sciences",
  "social-sciences": "Social Sciences",
};
const subjectName = (s?: string) => (s ? (SUBJECT_LABEL[s] ?? s.replace(/-/g, " ")) : null);

type Props = {
  destinationSlug: string;
  universitySlug: string;
  subject?: string;
  originSlug?: string;
};

/** Page is indexable when the institution is Duolingo-confirmed; the subject
 *  layer additionally needs AlmiStudy enrichment; origin leaves additionally
 *  need a researched origin (base or localized — both carry real substance). */
export function uniIndexable(p: Props): boolean {
  const { destinationSlug, universitySlug, subject, originSlug } = p;
  if (!isDetUniIndexable(destinationSlug, universitySlug)) return false;
  if (subject && !isDetUniSubjectIndexable(destinationSlug, universitySlug, subject)) return false;
  if (originSlug && !isDetOriginIndexable(originSlug)) return false;
  return true;
}

export function DetUniversityPage({ destinationSlug, universitySlug, subject, originSlug }: Props) {
  const uni = findDetUni(destinationSlug, universitySlug);
  const destName = detDestinationName(destinationSlug);
  const dest = lookupDetDestination(destinationSlug);
  const subjLabel = subjectName(subject);
  const origin = originSlug ? findDetOrigin(originSlug) : undefined;
  const loc = originSlug ? getLocalizedOrigin(originSlug) : undefined;
  const originName = origin?.name ?? (originSlug ? originSlug.replace(/-/g, " ") : null);

  // Unknown institution slug — honest gate-closed scaffold.
  if (!uni) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <header>
          <h1 className="text-2xl font-bold text-almi-ink">University DET requirements · {destName}</h1>
        </header>
        <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
          <p className="text-almi-text">
            We list institutions confirmed on Duolingo&apos;s own accepting-institutions list. This
            page is not one of them yet, so it is honest general guidance and is not indexed. See the{" "}
            <a href={`/requirements/${destinationSlug}`} className="text-almi-teal underline">{destName} requirements page</a>.
          </p>
        </section>
        <DetMasterShamool />
        <DetMasterDisclaimer />
      </main>
    );
  }

  const heading = `${uni.name}${subjLabel ? ` — ${subjLabel}` : ""}${originName ? ` from ${originName}` : ""}`;
  const faqs = [
    { q: `Does ${uni.name} accept the Duolingo English Test?`, a: `Yes — ${uni.name} is on Duolingo's official list of institutions that accept the Duolingo English Test. The exact score it asks for is set by the university and programme, so confirm the current figure on its official admissions page.` },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <FaqJsonLd faqs={faqs} />
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-almi-teal">University · {destName}</p>
        <h1 className="mt-1 text-2xl font-bold text-almi-ink">{heading} · Duolingo English Test</h1>
        <p className="mt-3 text-almi-text">
          {uni.name} accepts the Duolingo English Test — it is listed on Duolingo&apos;s official
          accepting-institutions list. Scores run on the 10–160 scale; {uni.name} and each programme
          set their own minimum, so confirm the figure on the official admissions page.
        </p>
      </header>

      {dest && (
        <section className="mt-8 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
          <h2 className="text-base font-semibold text-almi-ink">Country-level guidance for {destName}</h2>
          <p className="mt-2 text-sm text-almi-text">{dest.study.requirement}</p>
          <div className="mt-3 rounded-xl border border-almi-accent/40 bg-almi-bg p-4">
            <h3 className="text-sm font-semibold text-almi-ink">Admission is not the same as the visa</h3>
            <p className="mt-1 text-sm text-almi-text">{dest.visaNote}</p>
          </div>
        </section>
      )}

      {subjLabel && (
        <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
          <h2 className="text-base font-semibold text-almi-ink">{subjLabel} at {uni.name}</h2>
          <p className="mt-2 text-sm text-almi-text">
            {uni.name} offers programmes in {subjLabel.toLowerCase()} (per AlmiStudy course data). The
            Duolingo English Test is accepted for admission; confirm the programme&apos;s specific score
            on its official page.
          </p>
        </section>
      )}

      {origin && originName && (
        <section className="mt-6 rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
          <h2 className="text-base font-semibold text-almi-ink">Applying from {originName}</h2>
          <p className="mt-2 text-sm text-almi-text">
            At about $70 the DET is taken online from {originName} — no test-centre travel, and far
            cheaper than IELTS. {origin.languageNote}
          </p>
          <dl className="mt-2 space-y-1 text-sm text-almi-text">
            <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Credentials</dt><dd className="text-right">{origin.credentialBody}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Funding to search</dt><dd className="text-right">{origin.scholarshipCluster.join(", ")}</dd></div>
            {loc && <div className="flex justify-between gap-3"><dt className="text-almi-text-muted">Where students go</dt><dd className="text-right">{loc.topDestinations.join(", ")}</dd></div>}
          </dl>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-almi-ink">Common questions</h2>
        <dl className="mt-3 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-almi-ink">{f.q}</dt>
              <dd className="mt-1 text-sm text-almi-text">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DetMasterCrossLinks name={destName} />
      <DetMasterCta />
      <DetMasterShamool />
      <DetMasterDisclaimer />
    </main>
  );
}

export function buildDetUniversityMetadata(p: Props): Metadata {
  const { destinationSlug, universitySlug, subject, originSlug } = p;
  const uni = findDetUni(destinationSlug, universitySlug);
  const destName = detDestinationName(destinationSlug);
  const indexable = uniIndexable(p);
  const selfUrl =
    `${SITE_URL}/requirements/${destinationSlug}/${universitySlug}` +
    (subject ? `/${subject}` : "") +
    (originSlug ? `/from-${originSlug}` : "");
  const upUrl = uni
    ? `${SITE_URL}/requirements/${destinationSlug}/${universitySlug}`
    : `${SITE_URL}/requirements/${destinationSlug}`;

  if (!uni) {
    return {
      title: { absolute: `University DET requirements in ${destName} | AlmiDET` },
      description: `Per-university Duolingo English Test acceptance in ${destName}.`,
      alternates: { canonical: upUrl },
      robots: { index: false, follow: true },
    };
  }

  const subjLabel = subjectName(subject);
  const origin = originSlug ? findDetOrigin(originSlug) : undefined;
  const originName = origin?.name ?? null;
  const title =
    `${uni.name} — Duolingo English Test` +
    (subjLabel ? ` (${subjLabel})` : "") +
    (originName ? ` from ${originName}` : "") +
    ` | AlmiDET`;
  const description = `${uni.name} accepts the Duolingo English Test (on Duolingo's official list). DET score guidance on the 10–160 scale${originName ? ` for applicants from ${originName}` : ""}.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: indexable ? selfUrl : upUrl },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: selfUrl, type: "article", siteName: "AlmiDET" },
    twitter: { card: "summary", title, description },
  };
}
