// Founder admin — review + approve testimonials. Gated by canAccessAdmin.
// Reviews are unapproved by default; only approved ones would appear on any
// public surface (approval gates display).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/founder";
import { prisma } from "@/lib/prisma";
import { AdminReviews, type AdminReviewRow } from "./AdminReviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage() {
  const user = await requireUser();
  if (!isAdmin(user.email)) redirect("/");

  // Pending first (approved asc), newest first within each group.
  const reviews = await prisma.review.findMany({
    orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      rating: true,
      text: true,
      approved: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const rows: AdminReviewRow[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    approved: r.approved,
    createdAt: r.createdAt.toISOString(),
    userName: r.user?.name ?? null,
    userEmail: r.user?.email ?? null,
  }));

  return <AdminReviews rows={rows} />;
}
