import type { Metadata } from "next";
import { DetUniversityPage, buildDetUniversityMetadata } from "@/components/det-university-page";

export const revalidate = 86400;
export const dynamicParams = true;

// University × subject × origin (Matrix E). Indexable when the institution is on
// Duolingo's list AND AlmiStudy confirms the subject AND the origin is localized.
const FROM = "from-";
type Params = Promise<{ destination: string; seg: string; subject: string; originSeg: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination, seg, subject, originSeg } = await params;
  const origin = originSeg.startsWith(FROM) ? originSeg.slice(FROM.length) : originSeg;
  return buildDetUniversityMetadata({ destinationSlug: destination, universitySlug: seg, subject, originSlug: origin });
}

export default async function Page({ params }: { params: Params }) {
  const { destination, seg, subject, originSeg } = await params;
  const origin = originSeg.startsWith(FROM) ? originSeg.slice(FROM.length) : originSeg;
  return <DetUniversityPage destinationSlug={destination} universitySlug={seg} subject={subject} originSlug={origin} />;
}
