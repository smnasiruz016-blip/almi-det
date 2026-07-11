"use client";

// Star rating + single-text review form. Prefills the user's existing review,
// swaps the button to "Update review", and revalidates on success. Inline
// status line (no toast), unicode ★ (no icon lib).

import { useEffect, useState, useTransition } from "react";
import { getMyReview, submitOrUpdateReview } from "@/lib/reviews";
import { TEXT_MAX, TEXT_MIN } from "@/lib/reviews-shared";

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 text-3xl leading-none transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-almi-coral/40 disabled:cursor-not-allowed"
        >
          <span aria-hidden className={n <= display ? "text-almi-coral" : "text-almi-bg-peach"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ onSuccess }: { onSuccess?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);

  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getMyReview();
      if (cancelled) return;
      if (r.ok && r.review) {
        setHasExisting(true);
        setRating(r.review.rating);
        setText(r.review.text);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (trimmed.length < TEXT_MIN) {
      setError(`Please share at least ${TEXT_MIN} characters of feedback.`);
      return;
    }
    startTransition(async () => {
      const r = await submitOrUpdateReview({ rating, text: trimmed });
      if (r.ok) {
        setHasExisting(true);
        onSuccess?.();
      } else {
        setError(r.error);
      }
    });
  }

  if (loading) {
    return <p className="py-6 text-sm text-almi-text-muted">Loading…</p>;
  }

  const remaining = TEXT_MAX - text.length;
  const tooLong = text.length > TEXT_MAX;
  const submitLabel = hasExisting ? "Update review" : "Submit review";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-almi-text">
        How has AlmiDET been for your Duolingo English Test prep? Your feedback shapes what we build next.
      </p>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-almi-text-muted">
          Rating
        </label>
        <div className="mt-1">
          <StarPicker value={rating} onChange={setRating} disabled={pending} />
        </div>
      </div>

      <div>
        <label
          htmlFor="review-text"
          className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-almi-text-muted"
        >
          <span>Your review</span>
          <span className={"tabular-nums " + (remaining < 0 ? "text-almi-coral-deep" : "text-almi-text-muted")}>
            {text.length} / {TEXT_MAX}
          </span>
        </label>
        <textarea
          id="review-text"
          required
          minLength={TEXT_MIN}
          maxLength={TEXT_MAX}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What worked well? Which part helped most?"
          className="mt-1 w-full rounded-lg border border-almi-bg-peach bg-almi-paper px-3 py-2 text-sm text-almi-ink outline-none focus:border-almi-coral"
        />
      </div>

      {error && <p className="text-sm text-almi-coral-deep">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || tooLong || text.trim().length < TEXT_MIN}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-almi-coral px-5 py-2 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
