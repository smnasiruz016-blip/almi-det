"use client";

// Read and Complete composer. The passage renders inline; each gap shows its
// visible prefix followed by an input sized to the number of missing letters.
//
// The answer key never reaches this component: src/lib/det/client-payload.ts
// drops `missingLetters` and `alsoAccept`, projecting only `blankLength`. That
// count is deliberate — real DET draws one underscore per missing letter, so the
// length is part of the stimulus. Marking is server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ClientToken =
  | { kind: "text"; text: string }
  | { kind: "blank"; id: string; visiblePrefix: string; blankLength: number; suffix?: string };

export function ReadAndCompleteComposer({
  attemptId,
  prompt,
  passage,
}: {
  attemptId: string;
  prompt: string;
  passage: ClientToken[];
}) {
  const router = useRouter();
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  const blanks = passage.filter((t): t is Extract<ClientToken, { kind: "blank" }> => t.kind === "blank");
  const answered = blanks.filter((b) => (filled[b.id] ?? "").trim().length > 0).length;

  function setBlank(id: string, value: string, max: number) {
    // Letters only, capped at the number of missing letters — the input mirrors
    // exactly what the key can contain, so a taker cannot silently overrun it.
    const clean = value.replace(/[^A-Za-z]/g, "").slice(0, max);
    setFilled((prev) => ({ ...prev, [id]: clean }));
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
          response: { filled },
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

      <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
        <p className="text-lg leading-loose text-almi-ink">
          {passage.map((t, i) =>
            t.kind === "text" ? (
              <span key={i}>{t.text} </span>
            ) : (
              <span key={t.id} className="whitespace-nowrap">
                <span>{t.visiblePrefix}</span>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={filled[t.id] ?? ""}
                  onChange={(e) => setBlank(t.id, e.target.value, t.blankLength)}
                  aria-label={`Complete the word beginning ${t.visiblePrefix}, ${t.blankLength} letters missing`}
                  style={{ width: `${Math.max(2, t.blankLength) * 0.72}em` }}
                  className="mx-0.5 border-b-2 border-almi-coral bg-transparent text-center font-semibold text-almi-ink focus:border-almi-coral-deep focus:outline-none"
                />
                {t.suffix ?? ""}{" "}
              </span>
            ),
          )}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-almi-text-muted">
          {answered} of {blanks.length} gap{blanks.length === 1 ? "" : "s"} filled
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
        >
          {submitting ? "Checking…" : "Submit"}
        </button>
      </div>

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}
