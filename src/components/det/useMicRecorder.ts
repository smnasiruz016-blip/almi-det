"use client";

// THE MICROPHONE HALF OF THE SPEAKING KERNEL — shared by every spoken task type.
//
// One hook rather than a recorder inside each composer, because the fiddly parts
// are identical everywhere and each is a way to lose a taker's recording:
//
//   PERMISSION   getUserMedia can be denied, dismissed, or unavailable entirely
//                (no device, or a non-secure origin). Each needs a different
//                sentence, and "recording failed" for all three is useless.
//   THE TRACKS   a MediaStream keeps the mic light on until every track is
//                stopped. Forgetting leaves the browser recording indicator lit
//                after the task ends, which is alarming and looks like a bug.
//   THE CAP      recording stops itself at the task's limit. That bounds what a
//                single attempt can be billed at transcription — the client-side
//                half of the same cost discipline the server enforces.
//   THE BLOB     MediaRecorder emits chunks; the blob only exists on `stop`, so
//                anything that uploads must wait for that event rather than for
//                the stop() call to return.
//
// NO AUTOPLAY, NO HIDDEN CAPTURE. Recording starts only from a click and the
// state is always on screen.

import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "recording" | "stopped" | "denied" | "unsupported";

export type Recording = { blob: Blob; durationSeconds: number };

export function useMicRecorder(maxSeconds: number) {
  const [state, setState] = useState<MicState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // The mic must be released if the taker navigates away mid-recording.
  useEffect(() => releaseMic, [releaseMic]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setRecording(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError(
        "This browser cannot record audio here. Recording needs microphone support and a secure (https) connection.",
      );
      return;
    }

    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("denied");
      setError(
        "We could not use your microphone. Allow microphone access for this site, then try again.",
      );
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      releaseMic();
      setRecording({ blob, durationSeconds });
      setState("stopped");
    };

    startedAtRef.current = Date.now();
    rec.start();
    setState("recording");
    setSecondsLeft(maxSeconds);

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Hard stop at the limit — this is what bounds one attempt's cost.
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        return 0;
      });
    }, 1000);
  }, [maxSeconds, releaseMic]);

  const reset = useCallback(() => {
    releaseMic();
    setRecording(null);
    setSecondsLeft(maxSeconds);
    setState("idle");
    setError(null);
  }, [maxSeconds, releaseMic]);

  return { state, secondsLeft, recording, error, start, stop, reset };
}
