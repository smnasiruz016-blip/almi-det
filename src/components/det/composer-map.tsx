"use client";

// Data-driven render dispatch for the in-progress composer. A map of renderers
// keyed by task type — the attempt page never branches on task type itself.
// The server passes a SANITIZED payload (objective answer keys already removed).

import type { ReactNode } from "react";
import type { DetTaskType } from "@prisma/client";
import { ReadAndSelectComposer } from "@/components/det/ReadAndSelectComposer";
import { WriteAboutPhotoComposer } from "@/components/det/WriteAboutPhotoComposer";
import { ListenAndTypeComposer } from "@/components/det/ListenAndTypeComposer";
import { SpeakAboutPhotoComposer } from "@/components/det/SpeakAboutPhotoComposer";

type Args = { attemptId: string; prompt: string; payload: unknown };

const RENDERERS: Partial<Record<DetTaskType, (a: Args) => ReactNode>> = {
  READ_AND_SELECT: ({ attemptId, prompt, payload }) => {
    const p = payload as { words: { id: string; text: string }[] };
    return <ReadAndSelectComposer attemptId={attemptId} prompt={prompt} words={p.words} />;
  },
  LISTEN_AND_TYPE: ({ attemptId, prompt }) => {
    return <ListenAndTypeComposer attemptId={attemptId} prompt={prompt} />;
  },
  WRITE_ABOUT_THE_PHOTO: ({ attemptId, prompt, payload }) => {
    const p = payload as { imageUrl: string; imageAlt: string; minWords: number };
    return (
      <WriteAboutPhotoComposer
        attemptId={attemptId}
        prompt={prompt}
        imageUrl={p.imageUrl}
        imageAlt={p.imageAlt}
        minWords={p.minWords}
      />
    );
  },
  SPEAK_ABOUT_THE_PHOTO: ({ attemptId, prompt, payload }) => {
    const p = payload as {
      imageUrl: string;
      imageAlt: string;
      prepSeconds: number;
      speakSeconds: number;
    };
    return (
      <SpeakAboutPhotoComposer
        attemptId={attemptId}
        prompt={prompt}
        imageUrl={p.imageUrl}
        imageAlt={p.imageAlt}
        speakSeconds={p.speakSeconds}
      />
    );
  },
};

export function DetComposer({
  attemptId,
  taskType,
  prompt,
  payload,
}: {
  attemptId: string;
  taskType: DetTaskType;
  prompt: string;
  payload: unknown;
}) {
  const render = RENDERERS[taskType];
  if (!render) {
    return <p className="text-sm text-almi-text-muted">This task isn&apos;t available yet.</p>;
  }
  return <>{render({ attemptId, prompt, payload })}</>;
}
