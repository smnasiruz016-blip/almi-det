import type { Metadata } from "next";
import { DetCorridorPage, buildDetCorridorMetadata } from "@/components/det-corridor-page";
import { DetUniversityPage, buildDetUniversityMetadata } from "@/components/det-university-page";

export const revalidate = false; // render-once, cache until redeploy — static SEO data, no periodic ISR re-writes
export const dynamicParams = true;

// Dispatcher: /requirements/[destination]/from-[origin] → corridor (Matrix C);
// /requirements/[destination]/[university] → university detail (Duolingo list).
const FROM = "from-";
type Params = Promise<{ destination: string; seg: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination, seg } = await params;
  if (seg.startsWith(FROM)) return buildDetCorridorMetadata(destination, seg.slice(FROM.length));
  return buildDetUniversityMetadata({ destinationSlug: destination, universitySlug: seg });
}

export default async function Page({ params }: { params: Params }) {
  const { destination, seg } = await params;
  if (seg.startsWith(FROM)) {
    return <DetCorridorPage destinationSlug={destination} originSlug={seg.slice(FROM.length)} />;
  }
  return <DetUniversityPage destinationSlug={destination} universitySlug={seg} />;
}
