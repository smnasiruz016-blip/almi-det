import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetOriginPage, buildDetOriginMetadata } from "@/components/det-origin-page";

export const revalidate = false; // render-once, cache until redeploy — static SEO data, no periodic ISR re-writes
export const dynamicParams = true;

const FROM = "from-";
type Params = Promise<{ fromOrigin: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { fromOrigin } = await params;
  if (!fromOrigin.startsWith(FROM)) return {};
  return buildDetOriginMetadata(fromOrigin.slice(FROM.length));
}

export default async function Page({ params }: { params: Params }) {
  const { fromOrigin } = await params;
  if (!fromOrigin.startsWith(FROM)) notFound();
  return <DetOriginPage originSlug={fromOrigin.slice(FROM.length)} />;
}
