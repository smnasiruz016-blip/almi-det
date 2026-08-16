"use client";

// Writing Sample composer — 30 seconds to read, 5 minutes to write, one submit.
//
// NOT staged. There is one prompt and nothing to withhold: the taker is meant to
// be reading it during the prep window, so the prompt is on screen from the
// start and only the textarea is disabled. Making the prep a server-enforced
// stage would add a round trip and protect nothing.
//
// THE PRACTICE NOTE IS NOT DECORATION. In the official DET this sample is sent
// to institutions UNSCORED. We rate it because this is a practice tool and
// feedback is the point — but letting someone believe the real test scores it
// would be a lie about the exam. The sentence arrives in the PROJECTED PAYLOAD
// rather than being hardcoded here, so a redesign of this file cannot quietly
// drop it and gate:writing-leak can check it is there.

import { useEffect, useRef, useState } from "react";
import { useStagedAttempt, formatClock } from "@/components/det/useStagedAttempt";
import type { WSView } from "@/lib/det/tasks/writing-sample";

export type { WSView };

const CARD = "rounded-2xl border border-almi-bg-peach bg-almi-paper p-6";

export function WritingSampleComposer({
  attemptId,
  prompt,
  view,
}: {
  attemptId: string;
  prompt: string;
  view: WSView;
}) {
  // Only `finish` is used — this type has no stages to advance through.
  const { busy, error, finish } = useStagedAttempt<WSView>(attemptId, view);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"prep" | "write">("prep");
  const [left, setLeft] = useState(view.prepSeconds);
  const sent = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        clearInterval(id);
        if (phase === "prep") {
          setPhase("write");
          return view.writeSeconds;
        }
        if (!sent.current) {
          sent.current = true;
          finish({ text: textRef.current });
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, view.writeSeconds, finish]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const low = phase === "write" && left <= 30;

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>

      <p className="rounded-lg border border-almi-bg-peach bg-almi-bg-peach/40 px-3 py-2 text-xs text-almi-text">
        {view.practiceNote}
      </p>

      <div className={CARD}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
              {view.category} · {view.topic}
            </p>
            <p className="mt-2 text-base font-medium text-almi-ink">{view.prompt}</p>
          </div>
          <span
            aria-live="polite"
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
              low ? "bg-almi-coral/15 text-almi-coral-deep" : "bg-almi-bg-peach text-almi-ink"
            }`}
          >
            {formatClock(left)}
          </span>
        </div>

        <p className="mt-2 text-xs text-almi-text-muted">
          {phase === "prep"
            ? "Reading time — writing opens when the timer reaches zero."
            : `Write ${view.targetWords} words.`}
        </p>

        <textarea
          value={text}
          disabled={phase === "prep"}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={phase === "prep" ? "Read the prompt first…" : "Write your response…"}
          className="mt-4 w-full rounded-xl border border-almi-bg-peach bg-almi-paper p-4 text-sm text-almi-ink focus:border-almi-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-almi-bg-peach/40 disabled:text-almi-text-muted"
        />

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-almi-text-muted">
            {words} word{words === 1 ? "" : "s"} · target {view.targetWords} · submits
            automatically when the time runs out
          </p>
          <button
            type="button"
            onClick={() => {
              if (sent.current) return;
              sent.current = true;
              finish({ text });
            }}
            disabled={busy || phase === "prep"}
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
          >
            {busy ? "Checking…" : "Submit"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}
