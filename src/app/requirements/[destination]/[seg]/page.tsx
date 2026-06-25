import type { Metadata } from "next";
import { DetCorridorPage, buildDetCorridorMetadata } from "@/components/det-corridor-page";
import { DetUniversityPage, buildDetUniversityMetadata } from "@/components/det-university-page";

export const revalidate = 86400;
export const dynamicParams = true;

// Dispatcher: /requirements/[destination]/from-[origin] → corridor (Matrix C);
// /requirements/[destination]/[university] → university layer (gate-closed).
const FROM = "from-";
type Params = Promise<{ destination: string; seg: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination, seg } = await params;
  if (seg.startsWith(FROM)) return buildDetCorridorMetadata(destination, seg.slice(FROM.length));
  return buildDetUniversityMetadata(destination);
}

export default async function Page({ params }: { params: Params }) {
  const { destination, seg } = await params;
  if (seg.startsWith(FROM)) {
    return <DetCorridorPage destinationSlug={destination} originSlug={seg.slice(FROM.length)} />;
  }
  return <DetUniversityPage destinationSlug={destination} universitySlug={seg} />;
}
