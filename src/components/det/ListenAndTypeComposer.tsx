"use client";

// Listen and Type composer. Plays server-generated audio (the sentence text
// never reaches the client) a limited number of times; the user types what they
// hear. Marking is server-side and lenient.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_PLAYS = 3;

export function ListenAndTypeComposer({
  attemptId,
  prompt,
}: {
  attemptId: string;
  prompt: string;
}) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [plays, setPlays] = useState(0);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const startedAt = useState(() => Date.now())[0];

  function play() {
    if (plays >= MAX_PLAYS) return;
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().then(
      () => setPlays((p) => p + 1),
      () => setAudioError(true),
    );
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
          response: { typed },
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

      <audio
        ref={audioRef}
        src={`/api/det/audio/${attemptId}`}
        preload="none"
        onError={() => setAudioError(true)}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={play}
          disabled={plays >= MAX_PLAYS}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-accent px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-accent-deep disabled:opacity-50"
        >
          <span aria-hidden>▶</span> Play audio
        </button>
        <span className="text-sm text-almi-text-muted">
          {plays >= MAX_PLAYS ? "No plays left" : `${MAX_PLAYS - plays} play${MAX_PLAYS - plays === 1 ? "" : "s"} left`}
        </span>
      </div>

      {audioError && (
        <p className="text-sm text-almi-coral-deep">
          Audio could not load. Make sure your sound is on, then try Play again.
        </p>
      )}

      <div>
        <label htmlFor="typed" className="mb-1 block text-sm font-medium text-almi-ink">
          Type what you heard
        </label>
        <textarea
          id="typed"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          rows={3}
          placeholder="Type the sentence…"
          className="w-full rounded-xl border border-almi-bg-peach bg-almi-paper p-4 text-sm text-almi-ink focus:border-almi-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || typed.trim().length === 0}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
      >
        {submitting ? "Checking…" : "Submit answer"}
      </button>
    </div>
  );
}
