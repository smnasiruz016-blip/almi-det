"use client";

// Speak About the Photo composer. Records the user's voice (MediaRecorder),
// uploads it as multipart; the server transcribes with Whisper and scores the
// transcript. We never judge accent or audio — only the words — and say so.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "ready" | "recording" | "recorded" | "submitting";

export function SpeakAboutPhotoComposer({
  attemptId,
  prompt,
  imageUrl,
  imageAlt,
  speakSeconds,
}: {
  attemptId: string;
  prompt: string;
  imageUrl: string;
  imageAlt: string;
  speakSeconds: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [secondsLeft, setSecondsLeft] = useState(speakSeconds);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobRef.current = blob;
        durationRef.current = Math.round((Date.now() - startedAtRef.current) / 1000);
        setAudioUrl(URL.createObjectURL(blob));
        stopTracks();
        setPhase("recorded");
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setPhase("recording");
      setSecondsLeft(speakSeconds);
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            stopRecording();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setError("We couldn't access your microphone. Check your browser permissions and try again.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setPhase("ready");
    setSecondsLeft(speakSeconds);
  }

  async function submit() {
    if (!blobRef.current) return;
    setPhase("submitting");
    setError(null);
    setUpgrade(false);
    const form = new FormData();
    form.append("attemptId", attemptId);
    form.append("audio", blobRef.current, "speech.webm");
    form.append("durationSeconds", String(durationRef.current));
    form.append("timeSpentSeconds", String(durationRef.current));
    try {
      const res = await fetch("/api/det/submit", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setUpgrade(true);
        setPhase("recorded");
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setPhase("recorded");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setPhase("recorded");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>

      <figure className="overflow-hidden rounded-2xl border border-almi-bg-peach bg-almi-bg">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={imageAlt} className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-56 items-center justify-center bg-almi-accent/10 px-6 text-center">
            <span className="text-sm font-medium text-almi-ink">{imageAlt}</span>
          </div>
        )}
        <figcaption className="border-t border-almi-bg-peach px-4 py-2 text-xs text-almi-text-muted">
          The scene to talk about{imageUrl ? "" : " (illustrative — production uses licensed photos)"}.
        </figcaption>
      </figure>

      {phase === "ready" && (
        <button
          type="button"
          onClick={startRecording}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-coral px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
        >
          <span aria-hidden>●</span> Allow microphone & record
        </button>
      )}

      {phase === "recording" && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-coral-deep px-6 py-3 text-base font-semibold text-almi-on-dark"
          >
            <span aria-hidden>■</span> Stop & finish
          </button>
          <span className="text-sm font-semibold text-almi-coral-deep" aria-live="polite">
            Recording… {secondsLeft}s left
          </span>
        </div>
      )}

      {(phase === "recorded" || phase === "submitting") && audioUrl && (
        <div className="space-y-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={phase === "submitting"}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
            >
              {phase === "submitting" ? "Scoring…" : "Submit for feedback"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={phase === "submitting"}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-almi-ink/15 px-6 py-3 text-sm font-semibold text-almi-ink hover:border-almi-coral disabled:opacity-60"
            >
              Re-record
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-almi-text-muted">
        We estimate your speaking from a transcript of your words — not your accent or audio.
      </p>

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
    </div>
  );
}
