"use client";

// The client half of a staged task, shared by every composer that has one.
//
// Interactive Listening and Interactive Writing both need the same four things,
// and they are fiddly enough that two copies would drift:
//
//   · post a step to /api/det/staged/advance and swap in the view it returns;
//   · on a 409, still swap in the view — a rejection usually means the client
//     reloaded and is a stage behind, so resyncing in place beats stranding the
//     taker on a stage the server has already passed;
//   · post the final response to /api/det/submit and refresh so the server
//     component re-renders as the result screen;
//   · track busy/error without letting a failed request leave the UI stuck.
//
// What is NOT shared is the rendering. A turn loop with one-shot audio and a
// two-textarea flow have nothing visual in common, and a component general
// enough for both would be harder to read than either.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export function useStagedAttempt<TView>(attemptId: string, initialView: TView) {
  const router = useRouter();
  const [view, setView] = useState<TView>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  const advance = useCallback(
    async (step: unknown): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/det/staged/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, step }),
        });
        const data = await res.json();
        // Present on success AND on a 409 — the server's current view is the
        // truth either way.
        if (data.view) setView(data.view as TView);
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Something went wrong. Try again.");
          setBusy(false);
          return false;
        }
        setBusy(false);
        return true;
      } catch {
        setError("Network error. Try again.");
        setBusy(false);
        return false;
      }
    },
    [attemptId],
  );

  const finish = useCallback(
    async (response: unknown): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/det/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            response,
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
    },
    [attemptId, router, startedAt],
  );

  return { view, setView, busy, error, setError, advance, finish };
}

/**
 * A countdown that fires its callback ONCE, whichever comes first — the clock or
 * the taker. `sent` is a ref inside the caller, not state, because the timer must
 * not be able to fire a second submit between renders.
 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
