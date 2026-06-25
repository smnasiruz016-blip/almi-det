import type { Metadata } from "next";
import { DetUniversityPage, buildDetUniversityMetadata } from "@/components/det-university-page";

export const revalidate = 86400;
export const dynamicParams = true;

// University × subject × origin (Matrix E) — the ~3.7M ceiling. Scaffolded,
// gate-closed (noindex), canonical-up to the destination master until the
// Duolingo cross-reference is normalised. No fabricated per-university scores.
const FROM = "from-";
type Params = Promise<{ destination: string; seg: string; subject: string; originSeg: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination } = await params;
  return buildDetUniversityMetadata(destination);
}

export default async function Page({ params }: { params: Params }) {
  const { destination, seg, subject, originSeg } = await params;
  const origin = originSeg.startsWith(FROM) ? originSeg.slice(FROM.length) : originSeg;
  return (
    <DetUniversityPage destinationSlug={destination} universitySlug={seg} subject={subject} originSlug={origin} />
  );
}
