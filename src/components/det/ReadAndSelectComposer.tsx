"use client";

// Read and Select composer. The user toggles each string they believe is a
// real English word, then submits. Marking is server-side and deterministic;
// the answer key never reaches the client (the server strips `real` before
// passing words here).

import { useState } from "react";
import { useRouter } from "next/navigation";

type Word = { id: string; text: string };

export function ReadAndSelectComposer({
  attemptId,
  prompt,
  words,
}: {
  attemptId: string;
  prompt: string;
  words: Word[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/det/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          response: { selected: Array.from(selected) },
          timeSpentSeconds: Math.round((Date.now() - startedAt) / 1000),
        }),
      });
      const data = await res.json();
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {words.map((w) => {
          const on = selected.has(w.id);
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => toggle(w.id)}
              aria-pressed={on}
              className={`rounded-xl border px-4 py-3 text-center text-base font-medium transition ${
                on
                  ? "border-almi-accent bg-almi-accent/15 text-almi-ink"
                  : "border-almi-bg-peach bg-almi-paper text-almi-text hover:border-almi-accent/60"
              }`}
            >
              {w.text}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-almi-text-muted">
        Tap a word to mark it as a real English word. Leave invented words unmarked.
      </p>

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
      >
        {submitting ? "Checking…" : "Submit answers"}
      </button>
    </div>
  );
}
