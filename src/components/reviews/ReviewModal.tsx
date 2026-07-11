"use client";

// Review modal: backdrop + centered card on desktop / bottom sheet on mobile,
// Esc + backdrop dismiss, body scroll-lock. (No tt-* animation classes — the
// trio CSS doesn't define them; the modal renders without the entrance anim.)

import { useEffect } from "react";
import { ReviewForm } from "./ReviewForm";

export function ReviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share a review"
    >
      <div className="absolute inset-0 bg-almi-ink/40" aria-hidden onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-almi-paper shadow-xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-almi-bg-peach px-5 py-4">
          <h2 className="text-base font-semibold text-almi-ink">Share your experience</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-almi-text-muted hover:bg-almi-bg-peach hover:text-almi-ink"
          >
            <span aria-hidden className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <ReviewForm onSuccess={onClose} />
        </div>
        <div className="sm:hidden" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}
