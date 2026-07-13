import type { Metadata } from "next";
import { DetUniversityPage, buildDetUniversityMetadata } from "@/components/det-university-page";

export const revalidate = false; // render-once, cache until redeploy — static SEO data, no periodic ISR re-writes
export const dynamicParams = true;

// /requirements/[dest]/[uni]/from-[origin] → university × origin
// /requirements/[dest]/[uni]/[subject]     → university × subject (AlmiStudy-enriched)
const FROM = "from-";
type Params = Promise<{ destination: string; seg: string; subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination, seg, subject } = await params;
  if (subject.startsWith(FROM)) {
    return buildDetUniversityMetadata({ destinationSlug: destination, universitySlug: seg, originSlug: subject.slice(FROM.length) });
  }
  return buildDetUniversityMetadata({ destinationSlug: destination, universitySlug: seg, subject });
}

export default async function Page({ params }: { params: Params }) {
  const { destination, seg, subject } = await params;
  if (subject.startsWith(FROM)) {
    return <DetUniversityPage destinationSlug={destination} universitySlug={seg} originSlug={subject.slice(FROM.length)} />;
  }
  return <DetUniversityPage destinationSlug={destination} universitySlug={seg} subject={subject} />;
}
