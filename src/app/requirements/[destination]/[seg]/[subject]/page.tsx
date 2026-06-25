import type { Metadata } from "next";
import { DetUniversityPage, buildDetUniversityMetadata } from "@/components/det-university-page";

export const revalidate = 86400;
export const dynamicParams = true;

// University × subject (Matrix D/E) — scaffolded, gate-closed (noindex).
type Params = Promise<{ destination: string; seg: string; subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination } = await params;
  return buildDetUniversityMetadata(destination);
}

export default async function Page({ params }: { params: Params }) {
  const { destination, seg, subject } = await params;
  return <DetUniversityPage destinationSlug={destination} universitySlug={seg} subject={subject} />;
}
