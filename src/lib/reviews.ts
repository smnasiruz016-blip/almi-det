"use server";

// Logged-in review collection. One review per user, editable. `approved`
// defaults false and gates public display (admin approves at /admin/reviews).

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RATING_MAX, RATING_MIN, TEXT_MAX, TEXT_MIN } from "@/lib/reviews-shared";

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true } & T)
  | { ok: false; error: string };

export type MyReview = {
  id: string;
  rating: number;
  text: string;
  approved: boolean;
  createdAt: string;
};

export type MyReviewPayload = {
  review: MyReview | null;
};

export async function getMyReview(): Promise<Result<MyReviewPayload>> {
  const user = await requireUser();
  const review = await prisma.review.findFirst({
    where: { userId: user.id },
    select: { id: true, rating: true, text: true, approved: true, createdAt: true },
  });

  return {
    ok: true,
    review: review
      ? {
          id: review.id,
          rating: review.rating,
          text: review.text,
          approved: review.approved,
          createdAt: review.createdAt.toISOString(),
        }
      : null,
  };
}

export async function submitOrUpdateReview(input: {
  rating: number;
  text: string;
}): Promise<Result<{ reviewId: string }>> {
  const user = await requireUser();

  const rating = Math.floor(input.rating);
  if (!Number.isFinite(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return { ok: false, error: "Rating must be between 1 and 5 stars" };
  }
  const text = (input.text ?? "").trim();
  if (text.length < TEXT_MIN) {
    return { ok: false, error: `Please share at least ${TEXT_MIN} characters of feedback` };
  }
  if (text.length > TEXT_MAX) {
    return { ok: false, error: `Review must be ${TEXT_MAX} characters or fewer` };
  }

  // One review per user: update the existing row, otherwise create. Editing a
  // review re-enters moderation, so `approved` is reset to false on update.
  const existing = await prisma.review.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  let reviewId: string;
  if (existing) {
    const updated = await prisma.review.update({
      where: { id: existing.id },
      data: { rating, text, approved: false },
      select: { id: true },
    });
    reviewId = updated.id;
  } else {
    const created = await prisma.review.create({
      data: { userId: user.id, rating, text, approved: false },
      select: { id: true },
    });
    reviewId = created.id;
  }

  revalidatePath("/account");
  return { ok: true, reviewId };
}
