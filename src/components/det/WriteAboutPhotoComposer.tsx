"use client";

// Write About the Photo composer. The user writes a description; submit becomes
// available at the minimum word count. Scoring is an AI trait read (server-side) turned
// into an honest practice range. When imageUrl is empty we show a captioned
// scene placeholder — the AI judges against the same scene description, so the
// human and the rater stay consistent.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function WriteAboutPhotoComposer({
  attemptId,
  prompt,
  imageUrl,
  imageAlt,
  minWords,
}: {
  attemptId: string;
  prompt: string;
  imageUrl: string;
  imageAlt: string;
  minWords: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const startedAt = useState(() => Date.now())[0];
  const wordCount = useMemo(() => countWords(text), [text]);
  const ready = wordCount >= minWords;

  async function submit() {
    setSubmitting(true);
    setError(null);
    setUpgrade(false);
    try {
      const res = await fetch("/api/det/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          response: { text },
          timeSpentSeconds: Math.round((Date.now() - startedAt) / 1000),
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setUpgrade(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>

      <figure className="overflow-hidden rounded-2xl border border-almi-bg-peach bg-almi-bg">
        {imageUrl ? (
          // Plain <img> (no next/image domain config needed for the checkpoint).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={imageAlt} className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-56 items-center justify-center bg-almi-accent/10 px-6 text-center">
            <span className="text-sm font-medium text-almi-ink">{imageAlt}</span>
          </div>
        )}
        <figcaption className="border-t border-almi-bg-peach px-4 py-2 text-xs text-almi-text-muted">
          The scene to describe{imageUrl ? "" : " (illustrative — production uses licensed photos)"}.
        </figcaption>
      </figure>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Describe what you see…"
          className="w-full rounded-xl border border-almi-bg-peach bg-almi-paper p-4 text-sm text-almi-ink focus:border-almi-accent focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={ready ? "text-almi-teal" : "text-almi-text-muted"}>
            {wordCount} / {minWords} words
          </span>
          {!ready && <span className="text-almi-text-muted">Write at least {minWords} words to submit</span>}
        </div>
      </div>

      {upgrade && (
        <div className="rounded-xl border border-almi-accent/40 bg-almi-accent/10 px-4 py-3 text-sm text-almi-ink">
          AI feedback is part of a subscription.{" "}
          <a href="/pricing" className="font-semibold underline">
            See plans
          </a>
          .
        </div>
      )}
      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !ready}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
      >
        {submitting ? "Scoring…" : "Submit for feedback"}
      </button>
    </div>
  );
}
