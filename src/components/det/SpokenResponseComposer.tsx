"use client";

// One composer for the three rubric-based speaking types. They differ in what
// the taker is given and how long they get, not in what they do:
//
//   READ_THEN_SPEAK    a printed prompt, 90s
//   LISTEN_THEN_SPEAK  a question CLIP and no text at all, 90s
//   SPEAKING_SAMPLE    a printed prompt, 3 minutes, plus the practice note
//
// LISTEN THEN SPEAK PLAYS ONCE. There is no replay control, the same rule
// Interactive Listening's turns follow — the real test gives one listen, and a
// replay button would quietly change the task. The record control stays disabled
// until the clip has finished, so nobody starts answering a question they have
// not heard the end of.
//
// The transcript note is shown BEFORE recording, not only in the review. Someone
// about to be scored on speech deserves to know up front that the score comes
// from a transcript and says nothing about their accent.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMicRecorder } from "@/components/det/useMicRecorder";

export type SpokenView = {
  /** Printed prompt, or null when the task is audio-only. */
  prompt?: string;
  category?: string;
  /** Question clip for LISTEN_THEN_SPEAK. */
  audioUrl?: string | null;
  speakSeconds: number;
  transcriptNote: string;
  practiceNote?: string;
};

export function SpokenResponseComposer({
  attemptId,
  prompt,
  view,
  listenFirst,
}: {
  attemptId: string;
  prompt: string;
  view: SpokenView;
  /** True for LISTEN_THEN_SPEAK: the question must be heard before recording. */
  listenFirst: boolean;
}) {
  const router = useRouter();
  const mic = useMicRecorder(view.speakSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasClip = listenFirst && Boolean(view.audioUrl);
  const [played, setPlayed] = useState(false);
  // With no clip rendered there is nothing to wait for; the composer says so
  // rather than locking the taker out of an item that can never unlock.
  const [heard, setHeard] = useState(!listenFirst || !view.audioUrl);
  const [audioError, setAudioError] = useState(false);

  function playOnce() {
    if (played) return;
    const el = audioRef.current;
    if (!el) return;
    setPlayed(true); // before the promise resolves, so a double click cannot replay
    el.play().catch(() => {
      setAudioError(true);
      setHeard(true);
    });
  }

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

      {view.practiceNote && (
        <p className="rounded-lg border border-almi-bg-peach bg-almi-bg-peach/40 px-3 py-2 text-xs text-almi-text">
          {view.practiceNote}
        </p>
      )}

      <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
        {view.category && (
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
            {view.category}
          </p>
        )}

        {view.prompt ? (
          <p className="text-lg leading-relaxed text-almi-ink">{view.prompt}</p>
        ) : hasClip ? (
          <>
            <audio
              ref={audioRef}
              src={view.audioUrl ?? undefined}
              preload="auto"
              onEnded={() => setHeard(true)}
              onError={() => {
                setAudioError(true);
                setHeard(true);
              }}
            />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={playOnce}
                disabled={played}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-accent px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-accent-deep disabled:opacity-50"
              >
                <span aria-hidden>▶</span> {played ? "Played" : "Play the question"}
              </button>
              <span className="text-sm text-almi-text-muted">
                {heard
                  ? "You heard it once — that is all you get, as in the real test."
                  : played
                    ? "Listening…"
                    : "You will hear the question once. There is no text and no replay."}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-almi-coral-deep">
            The question audio has not been recorded yet, so this item cannot be answered as
            intended.
          </p>
        )}

        {audioError && (
          <p className="mt-3 text-sm text-almi-coral-deep">
            That clip could not play. Answer as best you can — the question is not shown as text.
          </p>
        )}
      </div>

      <p className="text-xs text-almi-text-muted">{view.transcriptNote}</p>

      <div className="flex flex-wrap items-center gap-4">
        {mic.state === "recording" ? (
          <button
            type="button"
            onClick={mic.stop}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-coral px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
          >
            <span
              aria-hidden
              className="inline-block h-3 w-3 animate-pulse rounded-full bg-almi-coral-deep"
            />
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            onClick={mic.start}
            disabled={busy || !heard || mic.state === "requesting"}
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
          {!heard
            ? "Listen to the question first."
            : mic.state === "recording"
              ? `Recording — ${mic.secondsLeft}s left`
              : mic.recording
                ? `Recorded ${mic.recording.durationSeconds}s. Listen back, or record again.`
                : `You have up to ${view.speakSeconds} seconds.`}
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
