"use client";

// Interactive Reading composer. The passage stays on screen throughout; the
// questions are worked through one at a time beneath it.
//
// Four sub-kinds render as a radio list of options. HIGHLIGHT_THE_ANSWER renders
// the passage's own sentences as the choices — which is why the payload stores
// the passage as uniform spans: every sentence is selectable, whether or not a
// question targets it, so the markup itself gives nothing away.
//
// No answer key reaches this component. client-payload.ts drops correctId and
// correctSpanId; what arrives is spans, stems and options.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ClientSpan = { id: string; text: string };
export type ClientOption = { id: string; text: string };
export type ClientQuestion =
  | { kind: "HIGHLIGHT_THE_ANSWER"; id: string; stem: string }
  | { kind: string; id: string; stem: string; options: ClientOption[] };

const KIND_LABEL: Record<string, string> = {
  COMPLETE_THE_SENTENCES: "Complete the sentence",
  COMPLETE_THE_PASSAGE: "Complete the passage",
  HIGHLIGHT_THE_ANSWER: "Find the answer in the passage",
  IDENTIFY_THE_IDEA: "Identify the main idea",
  TITLE_THE_PASSAGE: "Choose the best title",
};

export function InteractiveReadingComposer({
  attemptId,
  prompt,
  passage,
  questions,
}: {
  attemptId: string;
  prompt: string;
  passage: { spans: ClientSpan[] };
  questions: ClientQuestion[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  const q = questions[step];
  const isHighlight = q?.kind === "HIGHLIGHT_THE_ANSWER";
  const answered = questions.filter((x) => chosen[x.id]).length;
  const isLast = step + 1 >= questions.length;

  function pick(id: string) {
    setChosen((prev) => ({ ...prev, [q.id]: id }));
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
          response: { chosen },
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

  if (!q) return null;

  const choiceClass = (selected: boolean) =>
    `w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
      selected
        ? "border-almi-coral bg-almi-coral/10 text-almi-ink"
        : "border-almi-bg-peach bg-almi-paper text-almi-text hover:border-almi-accent"
    }`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>

      <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
        <p className="text-base leading-relaxed text-almi-ink">
          {passage.spans.map((s) =>
            isHighlight ? (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                aria-pressed={chosen[q.id] === s.id}
                className={`mr-1 rounded px-1 text-left ${
                  chosen[q.id] === s.id
                    ? "bg-almi-accent/30 font-medium text-almi-ink"
                    : "hover:bg-almi-bg-peach"
                }`}
              >
                {s.text}
              </button>
            ) : (
              <span key={s.id}>{s.text} </span>
            ),
          )}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          Question {step + 1} of {questions.length} · {KIND_LABEL[q.kind] ?? "Question"}
        </p>
        <p className="text-base font-medium text-almi-ink">{q.stem}</p>

        {isHighlight ? (
          <p className="text-sm text-almi-text-muted">
            Select the sentence in the passage above that answers this question.
          </p>
        ) : (
          <div className="space-y-2">
            {(q as { options: ClientOption[] }).options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o.id)}
                aria-pressed={chosen[q.id] === o.id}
                className={choiceClass(chosen[q.id] === o.id)}
              >
                {o.text}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-full border border-almi-ink/15 px-4 py-2 text-sm font-medium text-almi-ink disabled:opacity-40"
          >
            ← Back
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
              className="rounded-full border border-almi-ink/15 px-4 py-2 text-sm font-medium text-almi-ink"
            >
              Next →
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-almi-text-muted">
            {answered} of {questions.length} answered
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
      </div>

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}
