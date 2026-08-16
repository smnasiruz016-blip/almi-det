"use client";

// Interactive Writing composer — two prompts, and the first one is final.
//
//   Part 1   the prompt, a 5-minute countdown, a textarea. Submitting LOCKS it:
//            the textarea goes read-only and the server refuses a second Part 1.
//   Part 2   released only after Part 1 is recorded, with Part 1 shown READ-ONLY
//            beside it — the follow-up asks the taker to mitigate the downside
//            they themselves raised, so they need to see what they said, and
//            must not be able to change it.
//
// THIS COMPONENT DOES NOT HOLD PART 2's PROMPT until Part 1 is submitted. It is
// not hidden with CSS or held back in state — it is absent from props, because
// the projection did not send it. A taker who reads "now argue the other side"
// first writes a Part 1 built to be easy to reverse, and the pair stops
// measuring anything.
//
// No rubric reaches this file: `rubric.reference` is the rater's target in prose
// and the projection never emits it.

import { useEffect, useRef, useState } from "react";
import { useStagedAttempt, formatClock } from "@/components/det/useStagedAttempt";
import type { IWView, IWPartView } from "@/lib/det/tasks/interactive-writing";

export type { IWView };

const CARD = "rounded-2xl border border-almi-bg-peach bg-almi-paper p-6";

export function InteractiveWritingComposer({
  attemptId,
  prompt,
  view: initialView,
}: {
  attemptId: string;
  prompt: string;
  view: IWView;
}) {
  const { view, busy, error, advance, finish } = useStagedAttempt<IWView>(attemptId, initialView);
  const [part1, setPart1] = useState(initialView.part1.text);
  const [part2, setPart2] = useState(initialView.part2?.text ?? "");

  const onPart2 = view.part2 !== null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>

      <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
        {onPart2 ? "Part 2 of 2" : "Part 1 of 2"} · {view.topic}
        <span className="ml-2 font-normal normal-case text-almi-text-muted">
          {view.register} register
        </span>
      </p>

      <PartPanel
        part={view.part1}
        value={view.part1.locked ? view.part1.text : part1}
        onChange={setPart1}
        busy={busy}
        // The timer only runs while the part is actually open.
        running={!view.part1.locked}
        label="Part 1"
        submitLabel="Lock in Part 1 and continue →"
        onSubmit={() => advance({ kind: "part", key: "part1", text: part1 })}
      />

      {onPart2 && view.part2 && (
        <PartPanel
          part={view.part2}
          value={part2}
          onChange={setPart2}
          busy={busy}
          running
          label="Part 2"
          submitLabel="Submit both parts"
          onSubmit={async () => {
            // Save Part 2 through the same stage route first, so a network
            // failure on submit does not lose what was written; then score.
            await advance({ kind: "part", key: "part2", text: part2 });
            await finish({ text: { part2 } });
          }}
        />
      )}

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}

function PartPanel({
  part,
  value,
  onChange,
  busy,
  running,
  label,
  submitLabel,
  onSubmit,
}: {
  part: IWPartView;
  value: string;
  onChange: (v: string) => void;
  busy: boolean;
  running: boolean;
  label: string;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const [left, setLeft] = useState(part.seconds);
  const sent = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          // Time is up: submit whatever is there, once.
          if (!sent.current) {
            sent.current = true;
            onSubmit();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // onSubmit is recreated every render by design; the ref guard is what makes
    // a single submission safe, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const low = left <= 30;

  if (part.locked) {
    return (
      <div className={CARD}>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-text-muted">
          {label} · submitted
        </p>
        <p className="mt-1 text-sm text-almi-text-muted">{part.prompt}</p>
        <p className="mt-3 whitespace-pre-wrap rounded-xl border border-almi-ink/10 bg-almi-bg-peach/40 p-4 text-sm text-almi-ink">
          {part.text.trim() || "(nothing written)"}
        </p>
        <p className="mt-2 text-xs text-almi-text-muted">
          <span aria-hidden>🔒</span> Locked. Part 2 asks you to build on this, so it stays here
          — and it can no longer be changed.
        </p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-base font-medium text-almi-ink">{part.prompt}</p>
        <span
          aria-live="polite"
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
            low ? "bg-almi-coral/15 text-almi-coral-deep" : "bg-almi-bg-peach text-almi-ink"
          }`}
        >
          {formatClock(left)}
        </span>
      </div>

      <textarea
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Write your response…"
        className="mt-4 w-full rounded-xl border border-almi-bg-peach bg-almi-paper p-4 text-sm text-almi-ink focus:border-almi-accent focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-almi-text-muted">
          {words} word{words === 1 ? "" : "s"} · at least {part.minWords} · submits automatically
          when the time runs out
        </p>
        <button
          type="button"
          onClick={() => {
            if (sent.current) return;
            sent.current = true;
            onSubmit();
          }}
          disabled={busy}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
