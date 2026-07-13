import type { Metadata } from "next";
import { DetDestinationPage, buildDetDestinationMetadata } from "@/components/det-destination-page";

export const revalidate = false; // render-once, cache until redeploy — static SEO data, no periodic ISR re-writes
export const dynamicParams = true;

type Params = Promise<{ destination: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { destination } = await params;
  return buildDetDestinationMetadata(destination);
}

export default async function Page({ params }: { params: Params }) {
  const { destination } = await params;
  return <DetDestinationPage destinationSlug={destination} />;
}
