"use client";

// /account "Share your experience" card. Re-checks the user's review on mount
// and after the modal closes, flipping between the "share" and "you've shared"
// states. Submit/edit logic lives in ReviewModal/ReviewForm.

import { useEffect, useState } from "react";
import { getMyReview } from "@/lib/reviews";
import { ReviewModal } from "./ReviewModal";

export function ReviewCard() {
  const [open, setOpen] = useState(false);
  const [hasReview, setHasReview] = useState<boolean | null>(null);

  // Re-fetch when closed so a just-submitted first review flips the card to
  // the "Edit" state.
  useEffect(() => {
    if (open) return;
    let cancelled = false;
    (async () => {
      const r = await getMyReview();
      if (cancelled) return;
      setHasReview(r.ok ? r.review !== null : false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loading = hasReview === null;

  return (
    <>
      <section className="mx-auto max-w-2xl rounded-2xl border border-almi-bg-peach bg-almi-paper p-8 text-center shadow-sm">
        <p aria-hidden className="text-3xl leading-none text-almi-coral">★</p>
        <h2 className="mt-2 text-xl font-semibold text-almi-ink">
          {hasReview ? "You've shared a review" : "Share your experience"}
        </h2>
        <p className="mt-2 text-sm text-almi-text-muted">
          {hasReview
            ? "Thank you! You can update your rating or words anytime."
            : "Help us improve AlmiDET — your feedback shapes what we build next."}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={loading}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
        >
          {loading ? "Loading…" : hasReview ? "Edit your review" : "Write a review"}
        </button>
      </section>

      <ReviewModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
