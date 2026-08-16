"use client";

// Interactive Listening composer — three stages, and the taker only ever holds
// one of them.
//
//   A  Listen and Complete   the scenario clip, REPLAYABLE, and a transcript
//                            with whole-word gaps to type. Submitting locks the
//                            gaps for good.
//   B  Listen and Respond     one turn at a time. Turn 1 is the opener and has
//                            no audio. Every other turn plays ONCE — there is no
//                            replay control, because real DET gives you one
//                            listen and a replay button would quietly change the
//                            task. Options appear only after the clip ends.
//   C  Summarize              the prompt, a textarea, and 75 seconds.
//
// THIS COMPONENT DOES NOT HOLD THE ITEM. It holds a view — the stage the server
// has released. Turns 2..N and the summary prompt are not in props at all until
// /api/det/il/advance returns them, so the stage locks are not a UI convention
// that devtools can step around. The lock the taker sees here and the lock the
// server enforces are the same lock; this one just explains itself.
//
// No answer key reaches this file: no `line`, no `correct`, no `missing`, no
// `reference`, no `keyPoints`. Options arrive permuted and the component posts
// back the POSITION IT DISPLAYED, never a key.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ILView, ILTurnView, ILSummarizeView } from "@/lib/det/il-stages";

export type { ILView };

const CARD = "rounded-2xl border border-almi-bg-peach bg-almi-paper p-6";
const STAGE_LABEL: Record<ILView["stage"], string> = {
  A: "Part 1 of 3 · Listen and complete",
  B: "Part 2 of 3 · Listen and respond",
  C: "Part 3 of 3 · Summarize",
};

export function InteractiveListeningComposer({
  attemptId,
  prompt,
  view: initialView,
}: {
  attemptId: string;
  prompt: string;
  view: ILView;
}) {
  const router = useRouter();
  const [view, setView] = useState<ILView>(initialView);
  const [filled, setFilled] = useState<Record<string, string>>(initialView.complete.filled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  const blanks = view.complete.text.filter((c) => c.kind === "blank");

  async function advance(step: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/det/il/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, step }),
      });
      const data = await res.json();
      // A 409 still carries the server's current view — resync rather than
      // stranding the taker on a stage the server has already moved past.
      if (data.view) setView(data.view as ILView);
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      setBusy(false);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  async function finish(summary: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/det/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          // Only the summary. Parts 1 and 2 were recorded stage by stage and are
          // read from the database — this request cannot revise them.
          response: { summary },
          timeSpentSeconds: Math.round((Date.now() - startedAt) / 1000),
        }),
      });
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

      <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
        {STAGE_LABEL[view.stage]}
      </p>

      <div className={CARD}>
        <p className="text-sm text-almi-ink">
          <span className="font-semibold">{view.scenario.setting}.</span> You are{" "}
          <span className="font-semibold">{view.scenario.youAre}</span>, talking with{" "}
          <span className="font-semibold">{view.scenario.speakerName}</span>.
        </p>
        <p className="mt-1 text-xs text-almi-text-muted">Register: {view.scenario.register}</p>
      </div>

      <TranscriptStage
        view={view}
        filled={filled}
        setFilled={setFilled}
        blankCount={blanks.length}
        busy={busy}
        onSubmit={() => advance({ kind: "complete", filled })}
      />

      {view.current?.kind === "turn" && (
        <TurnStage
          key={view.current.index}
          turn={view.current}
          busy={busy}
          onPick={(position) =>
            advance({ kind: "turn", index: (view.current as ILTurnView).index, chosen: position })
          }
        />
      )}

      {view.current?.kind === "summarize" && (
        <SummarizeStage summarize={view.current} busy={busy} onSubmit={finish} />
      )}

      {error && <p className="text-sm font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Stage A ---

function TranscriptStage({
  view,
  filled,
  setFilled,
  blankCount,
  busy,
  onSubmit,
}: {
  view: ILView;
  filled: Record<string, string>;
  setFilled: (f: Record<string, string>) => void;
  blankCount: number;
  busy: boolean;
  onSubmit: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [plays, setPlays] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const locked = view.complete.locked;
  const typedCount = Object.values(filled).filter((v) => v.trim()).length;

  function play() {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().then(
      () => setPlays((p) => p + 1),
      () => setAudioError(true),
    );
  }

  return (
    <div className={CARD}>
      {!locked && (
        <>
          {view.complete.audioUrl ? (
            <>
              <audio
                ref={audioRef}
                src={view.complete.audioUrl}
                preload="none"
                onError={() => setAudioError(true)}
              />
              <div className="mb-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={play}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-accent px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-accent-deep"
                >
                  <span aria-hidden>▶</span> {plays === 0 ? "Play the message" : "Play again"}
                </button>
                <span className="text-sm text-almi-text-muted">
                  You can replay this part as often as you like.
                </span>
              </div>
            </>
          ) : (
            <p className="mb-4 text-sm text-almi-coral-deep">
              The audio for this message has not been recorded yet. You can still read the
              transcript and fill the gaps.
            </p>
          )}
          {audioError && (
            <p className="mb-4 text-sm text-almi-coral-deep">
              Audio could not load. Check your sound is on, then try Play again.
            </p>
          )}
        </>
      )}

      <p className="text-base leading-loose text-almi-ink">
        {view.complete.text.map((c, i) =>
          c.kind === "text" ? (
            <span key={i}>{c.text}</span>
          ) : (
            <input
              key={i}
              type="text"
              aria-label={`Gap ${c.id.replace("b", "")}`}
              value={filled[c.id] ?? ""}
              readOnly={locked}
              disabled={locked}
              onChange={(e) => setFilled({ ...filled, [c.id]: e.target.value })}
              size={10}
              className={`mx-1 inline-block w-28 rounded-md border-b-2 px-2 py-1 text-center text-sm ${
                locked
                  ? "border-almi-ink/20 bg-almi-bg-peach/40 font-medium text-almi-ink"
                  : "border-almi-accent bg-almi-paper text-almi-ink focus:border-almi-coral focus:outline-none"
              }`}
            />
          ),
        )}
      </p>

      {locked ? (
        <p className="mt-4 text-xs text-almi-text-muted">
          <span aria-hidden>🔒</span> Part 1 is submitted and can no longer be changed. The
          transcript stays here so you can follow the conversation.
        </p>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xs text-almi-text-muted">
            {typedCount} of {blankCount} gaps filled · you cannot change these once you continue
          </p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
          >
            {busy ? "Saving…" : "Lock in and continue →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Stage B ---

function TurnStage({
  turn,
  busy,
  onPick,
}: {
  turn: ILTurnView;
  busy: boolean;
  onPick: (position: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // The opener has nothing to hear, and a turn whose clip was never rendered
  // cannot be heard — in both cases the options are available immediately
  // rather than dead-ending the attempt behind audio that will never play.
  const hasAudio = !turn.opener && Boolean(turn.audioUrl);
  const [played, setPlayed] = useState(!hasAudio);
  const [finishedListening, setFinishedListening] = useState(!hasAudio);
  const [audioError, setAudioError] = useState(false);

  function playOnce() {
    if (played) return;
    const el = audioRef.current;
    if (!el) return;
    setPlayed(true); // set BEFORE the promise resolves, so a double click cannot replay
    el.play().catch(() => {
      setAudioError(true);
      setFinishedListening(true);
    });
  }

  return (
    <div className={CARD}>
      <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
        Turn {turn.index + 1} of {turn.total}
      </p>

      {turn.opener ? (
        <p className="mt-2 text-base font-medium text-almi-ink">
          Start the conversation. Choose the best way to begin.
        </p>
      ) : hasAudio ? (
        <>
          <audio
            ref={audioRef}
            src={turn.audioUrl ?? undefined}
            preload="auto"
            onEnded={() => setFinishedListening(true)}
            onError={() => {
              setAudioError(true);
              setFinishedListening(true);
            }}
          />
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              onClick={playOnce}
              disabled={played}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-almi-accent px-6 py-3 text-base font-semibold text-almi-ink hover:bg-almi-accent-deep disabled:opacity-50"
            >
              <span aria-hidden>▶</span> {played ? "Played" : "Listen"}
            </button>
            <span className="text-sm text-almi-text-muted">
              {finishedListening
                ? "You heard this once — that is all you get, as in the real test."
                : played
                  ? "Listening…"
                  : "You will hear this once. There is no replay."}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-almi-coral-deep">
          The audio for this turn has not been recorded yet. Choose the reply that fits the
          conversation so far.
        </p>
      )}

      {audioError && (
        <p className="mt-3 text-sm text-almi-coral-deep">
          That clip could not play. Answer from the conversation so far — this turn is not
          replayed.
        </p>
      )}

      {finishedListening && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-almi-ink">Choose your reply</p>
          {turn.options.map((text, position) => (
            <button
              key={position}
              type="button"
              disabled={busy}
              onClick={() => onPick(position)}
              className="w-full rounded-xl border border-almi-bg-peach bg-almi-paper px-4 py-3 text-left text-sm text-almi-text transition hover:border-almi-accent disabled:opacity-60"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Stage C ---

function SummarizeStage({
  summarize,
  busy,
  onSubmit,
}: {
  summarize: ILSummarizeView;
  busy: boolean;
  onSubmit: (summary: string) => void;
}) {
  const [text, setText] = useState("");
  const [left, setLeft] = useState(summarize.seconds);
  const sent = useRef(false);

  // One submit, whichever comes first — the button or the clock. `sent` is a ref
  // rather than state so the timer cannot fire a second submit between renders.
  const submit = useCallback(
    (value: string) => {
      if (sent.current) return;
      sent.current = true;
      onSubmit(value);
    },
    [onSubmit],
  );

  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          submit(textRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [submit]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const low = left <= 15;

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-base font-medium text-almi-ink">{summarize.prompt}</p>
        <span
          aria-live="polite"
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
            low ? "bg-almi-coral/15 text-almi-coral-deep" : "bg-almi-bg-peach text-almi-ink"
          }`}
        >
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>

      <textarea
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Write what the conversation was about, in your own words…"
        className="mt-4 w-full rounded-xl border border-almi-bg-peach bg-almi-paper p-4 text-sm text-almi-ink focus:border-almi-accent focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-almi-text-muted">
          {words} word{words === 1 ? "" : "s"} · submits automatically when the time runs out
        </p>
        <button
          type="button"
          onClick={() => submit(text)}
          disabled={busy}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep disabled:opacity-60"
        >
          {busy ? "Checking…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
