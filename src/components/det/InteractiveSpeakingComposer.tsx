"use client";

// Interactive Speaking composer — a spoken interview, one question at a time.
//
// Each turn: hear the question ONCE, record an answer of up to 35 seconds, send
// it. The next question arrives in the response and replaces this one. There is
// no way to skip ahead and no way to go back.
//
// THE COMPONENT NEVER HOLDS MORE THAN ONE QUESTION. Turn n+1's clip is not in
// props until turn n has been transcribed and stored server-side, so "one at a
// time" is not a UI convention that devtools can step around. It is the same
// staged kernel Interactive Listening and Interactive Writing use, with an audio
// upload where they have a JSON step.
//
// NO QUESTION TEXT EXISTS ON THIS PAGE. The projection has no field that could
// carry it — only a clip URL and a duration.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMicRecorder } from "@/components/det/useMicRecorder";

export type ISTurnView = {
  index: number;
  total: number;
  audioUrl: string | null;
  maxSeconds: number;
};

export type ISView = {
  stage: "turn" | "done";
  topic: string;
  register: string;
  answered: number;
  current: ISTurnView | null;
  transcriptNote: string;
};

export function InteractiveSpeakingComposer({
  attemptId,
  prompt,
  view: initialView,
}: {
  attemptId: string;
  prompt: string;
  view: ISView;
}) {
  const router = useRouter();
  const [view, setView] = useState<ISView>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  const turn = view.current;
  const mic = useMicRecorder(turn?.maxSeconds ?? 35);

  return (
    <div className="space-y-6">
      <p className="text-sm text-almi-text">{prompt}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
        {view.topic} · {view.register} register
        {turn && (
          <span className="ml-2 font-normal normal-case text-almi-text-muted">
            Question {turn.index + 1} of {turn.total}
          </span>
        )}
      </p>

      {turn ? (
        <TurnPanel
          // Remounts on every turn, so the recorder and the play-once state
          // reset cleanly rather than leaking the previous answer forward.
          key={turn.index}
          turn={turn}
          mic={mic}
          busy={busy}
          onSend={async (blob, seconds) => {
            setBusy(true);
            setError(null);
            try {
              const form = new FormData();
              form.append("attemptId", attemptId);
              form.append("turnIndex", String(turn.index));
              form.append("audio", blob, "speech.webm");
              form.append("durationSeconds", String(seconds));
              form.append(
                "timeSpentSeconds",
                String(Math.round((Date.now() - startedAt) / 1000)),
              );
              const res = await fetch("/api/det/speak/submit", { method: "POST", body: form });
              const data = await res.json();
              if (data.view) setView(data.view as ISView);
              if (!res.ok || !data.ok) {
                setError(data.error ?? "Something went wrong. Try again.");
                setBusy(false);
                return;
              }
              if (data.finished) {
                router.refresh();
                return;
              }
              mic.reset();
              setBusy(false);
            } catch {
              setError("Network error. Try again.");
              setBusy(false);
            }
          }}
        />
      ) : (
        <p className="text-sm text-almi-text">
          That was the last question — scoring the whole interview…
        </p>
      )}

      <p className="text-xs text-almi-text-muted">{view.transcriptNote}</p>
      {mic.error && <p className="text-sm font-medium text-almi-coral-deep">{mic.error}</p>}
      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}

function TurnPanel({
  turn,
  mic,
  busy,
  onSend,
}: {
  turn: ISTurnView;
  mic: ReturnType<typeof useMicRecorder>;
  busy: boolean;
  onSend: (blob: Blob, seconds: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [played, setPlayed] = useState(false);
  // With no clip rendered there is nothing to wait for; the composer says so
  // rather than locking the taker out of a turn that can never unlock.
  const [heard, setHeard] = useState(!turn.audioUrl);
  const [audioError, setAudioError] = useState(false);
  const sent = useRef(false);

  // The answer goes as soon as the recording exists — one turn, one take. The
  // ref guard is what stops the effect firing twice across renders.
  useEffect(() => {
    if (mic.recording && !sent.current) {
      sent.current = true;
      onSend(mic.recording.blob, mic.recording.durationSeconds);
    }
  }, [mic.recording, onSend]);

  function playOnce() {
    if (played) return;
    const el = audioRef.current;
    if (!el) return;
    setPlayed(true);
    el.play().catch(() => {
      setAudioError(true);
      setHeard(true);
    });
  }

  return (
    <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-6">
      {turn.audioUrl ? (
        <>
          <audio
            ref={audioRef}
            src={turn.audioUrl}
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
                  : "You will hear this question once. There is no text and no replay."}
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm text-almi-coral-deep">
          This question&apos;s audio has not been recorded yet, so the interview cannot run as
          intended.
        </p>
      )}

      {audioError && (
        <p className="mt-3 text-sm text-almi-coral-deep">
          That clip could not play. The question is not shown as text — answer as best you can.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
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
            Stop and send
          </button>
        ) : (
          <button
            type="button"
            onClick={mic.start}
            disabled={busy || !heard || Boolean(mic.recording)}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-accent px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-accent-deep disabled:opacity-50"
          >
            <span aria-hidden>●</span>{" "}
            {busy ? "Sending…" : mic.state === "requesting" ? "Waiting for the microphone…" : "Answer now"}
          </button>
        )}
        <span aria-live="polite" className="text-sm text-almi-text-muted">
          {!heard
            ? "Listen to the question first."
            : mic.state === "recording"
              ? `Recording — ${mic.secondsLeft}s left`
              : busy
                ? "Sending your answer…"
                : `Up to ${turn.maxSeconds} seconds. One take — your answer sends when you stop.`}
        </span>
      </div>
    </div>
  );
}
