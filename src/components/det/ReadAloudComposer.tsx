"use client";

// Read Aloud composer — the sentence, a record control, and an upload.
//
// The sentence is on screen throughout, because reading it IS the task. There is
// no key to hide and nothing is withheld by time.
//
// The taker may re-record before submitting: a first take ruined by a cough is
// not a language failure, and nothing has been spent yet — the upload is what
// costs money, so the retake is free and the submit is the commitment. That is
// also why submit is a separate deliberate click rather than firing on stop.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMicRecorder } from "@/components/det/useMicRecorder";

export type ReadAloudView = { text: string };

export function ReadAloudComposer({
  attemptId,
  prompt,
  view,
  recordSeconds,
}: {
  attemptId: string;
  prompt: string;
  view: ReadAloudView;
  recordSeconds: number;
}) {
  const router = useRouter();
  const mic = useMicRecorder(recordSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  async function submit() {
    if (!mic.recording) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("attemptId", attemptId);
      form.append("audio", mic.recording.blob, "speech.webm");
      form.append("durationSeconds", String(mic.recording.durationSeconds));
      form.append("timeSpentSeconds", String(Math.round((Date.now() - startedAt) / 1000)));

      const res = await fetch("/api/det/speak/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>

      <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
        <p className="text-xl leading-relaxed text-almi-ink">{view.text}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {mic.state === "recording" ? (
          <button
            type="button"
            onClick={mic.stop}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-coral px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
          >
            <span aria-hidden className="inline-block h-3 w-3 animate-pulse rounded-full bg-almi-coral-deep" />
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            onClick={mic.start}
            disabled={busy || mic.state === "requesting"}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-accent px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-accent-deep disabled:opacity-50"
          >
            <span aria-hidden>●</span>{" "}
            {mic.state === "requesting"
              ? "Waiting for the microphone…"
              : mic.recording
                ? "Record again"
                : "Start recording"}
          </button>
        )}

        <span aria-live="polite" className="text-sm text-almi-text-muted">
          {mic.state === "recording"
            ? `Recording — ${mic.secondsLeft}s left`
            : mic.recording
              ? `Recorded ${mic.recording.durationSeconds}s. Listen back, or record again.`
              : `You have up to ${recordSeconds} seconds.`}
        </span>
      </div>

      {mic.recording && (
        <audio
          controls
          src={URL.createObjectURL(mic.recording.blob)}
          className="w-full"
          aria-label="Your recording"
        />
      )}

      {mic.error && <p className="text-sm font-medium text-almi-coral-deep">{mic.error}</p>}
      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !mic.recording || mic.state === "recording"}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
        >
          {busy ? "Checking…" : "Submit recording"}
        </button>
        <p className="text-xs text-almi-text-muted">
          Re-recording is free — only submitting sends the audio to be transcribed.
        </p>
      </div>
    </div>
  );
}
