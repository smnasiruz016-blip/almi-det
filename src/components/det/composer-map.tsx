"use client";

// Data-driven render dispatch for the in-progress composer. A map of renderers
// keyed by task type — the attempt page never branches on task type itself.
//
// The payload arriving here has already been projected by
// src/lib/det/client-payload.ts, so it carries no answer key and no rater
// target. Nothing in this file may reach for a field that projection withholds:
// the photo composers get their alt text from the item TITLE (already on screen
// as the <h1>), never from `imageAlt`.

import type { ReactNode } from "react";
import type { DetTaskType } from "@prisma/client";
import { ReadAndSelectComposer } from "@/components/det/ReadAndSelectComposer";
import { WriteAboutPhotoComposer } from "@/components/det/WriteAboutPhotoComposer";
import { ListenAndTypeComposer } from "@/components/det/ListenAndTypeComposer";
import { ReadAndCompleteComposer, type ClientToken } from "@/components/det/ReadAndCompleteComposer";
import {
  InteractiveReadingComposer,
  type ClientQuestion,
  type ClientSpan,
} from "@/components/det/InteractiveReadingComposer";
import { SpeakAboutPhotoComposer } from "@/components/det/SpeakAboutPhotoComposer";
import {
  InteractiveListeningComposer,
  type ILView,
} from "@/components/det/InteractiveListeningComposer";
import {
  InteractiveWritingComposer,
  type IWView,
} from "@/components/det/InteractiveWritingComposer";
import { WritingSampleComposer, type WSView } from "@/components/det/WritingSampleComposer";
import { ReadAloudComposer, type ReadAloudView } from "@/components/det/ReadAloudComposer";
import {
  SpokenResponseComposer,
  type SpokenView,
} from "@/components/det/SpokenResponseComposer";
import { speakingTaskFor } from "@/lib/det/speaking-tasks";

type Args = { attemptId: string; prompt: string; title: string; payload: unknown };

const RENDERERS: Partial<Record<DetTaskType, (a: Args) => ReactNode>> = {
  READ_AND_SELECT: ({ attemptId, prompt, payload }) => {
    const p = payload as { words: { id: string; text: string }[] };
    return <ReadAndSelectComposer attemptId={attemptId} prompt={prompt} words={p.words} />;
  },
  // Same payload shape, same renderer. Fill in the Blanks is READ_AND_COMPLETE
  // at sentence scope; the difference is a content rule the gate enforces, not a
  // different interaction.
  READ_AND_COMPLETE: ({ attemptId, prompt, payload }) => {
    const p = payload as { passage: ClientToken[] };
    return <ReadAndCompleteComposer attemptId={attemptId} prompt={prompt} passage={p.passage} />;
  },
  FILL_IN_THE_BLANKS: ({ attemptId, prompt, payload }) => {
    const p = payload as { passage: ClientToken[] };
    return <ReadAndCompleteComposer attemptId={attemptId} prompt={prompt} passage={p.passage} />;
  },
  INTERACTIVE_READING: ({ attemptId, prompt, payload }) => {
    const p = payload as { passage: { spans: ClientSpan[] }; questions: ClientQuestion[] };
    return (
      <InteractiveReadingComposer
        attemptId={attemptId}
        prompt={prompt}
        passage={p.passage}
        questions={p.questions}
      />
    );
  },
  LISTEN_AND_TYPE: ({ attemptId, prompt }) => {
    return <ListenAndTypeComposer attemptId={attemptId} prompt={prompt} />;
  },
  // The "payload" here is a STAGE VIEW, not the item — it carries only what the
  // taker has reached. Later turns and the summary prompt arrive from
  // /api/det/il/advance as each stage is submitted.
  INTERACTIVE_LISTENING: ({ attemptId, prompt, payload }) => {
    return (
      <InteractiveListeningComposer
        attemptId={attemptId}
        prompt={prompt}
        view={payload as ILView}
      />
    );
  },
  // Like Interactive Listening, the "payload" is a STAGE VIEW: Part 2's prompt
  // is not in it until Part 1 is submitted.
  INTERACTIVE_WRITING: ({ attemptId, prompt, payload }) => {
    return (
      <InteractiveWritingComposer
        attemptId={attemptId}
        prompt={prompt}
        view={payload as IWView}
      />
    );
  },
  WRITING_SAMPLE: ({ attemptId, prompt, payload }) => {
    return (
      <WritingSampleComposer attemptId={attemptId} prompt={prompt} view={payload as WSView} />
    );
  },
  WRITE_ABOUT_THE_PHOTO: ({ attemptId, prompt, title, payload }) => {
    const p = payload as { imageUrl: string; minWords: number };
    return (
      <WriteAboutPhotoComposer
        attemptId={attemptId}
        prompt={prompt}
        imageUrl={p.imageUrl}
        alt={title}
        minWords={p.minWords}
      />
    );
  },
  // The recording limit comes from the speaking registry, not a literal here —
  // it is the same number that bounds what one attempt can be billed at.
  READ_ALOUD: ({ attemptId, prompt, payload }) => {
    return (
      <ReadAloudComposer
        attemptId={attemptId}
        prompt={prompt}
        view={payload as ReadAloudView}
        recordSeconds={speakingTaskFor("READ_ALOUD")?.recordSeconds ?? 30}
      />
    );
  },
  // One composer, three types. LISTEN_THEN_SPEAK passes listenFirst so the
  // record control stays disabled until the question clip has finished — its
  // stimulus is audio only, and there is no text to fall back on.
  READ_THEN_SPEAK: ({ attemptId, prompt, payload }) => (
    <SpokenResponseComposer
      attemptId={attemptId}
      prompt={prompt}
      view={payload as SpokenView}
      listenFirst={false}
    />
  ),
  LISTEN_THEN_SPEAK: ({ attemptId, prompt, payload }) => (
    <SpokenResponseComposer
      attemptId={attemptId}
      prompt={prompt}
      view={payload as SpokenView}
      listenFirst
    />
  ),
  SPEAKING_SAMPLE: ({ attemptId, prompt, payload }) => (
    <SpokenResponseComposer
      attemptId={attemptId}
      prompt={prompt}
      view={payload as SpokenView}
      listenFirst={false}
    />
  ),
  SPEAK_ABOUT_THE_PHOTO: ({ attemptId, prompt, title, payload }) => {
    const p = payload as {
      imageUrl: string;
      prepSeconds: number;
      speakSeconds: number;
    };
    return (
      <SpeakAboutPhotoComposer
        attemptId={attemptId}
        prompt={prompt}
        imageUrl={p.imageUrl}
        alt={title}
        speakSeconds={p.speakSeconds}
      />
    );
  },
};

export function DetComposer({
  attemptId,
  taskType,
  prompt,
  title,
  payload,
}: {
  attemptId: string;
  taskType: DetTaskType;
  prompt: string;
  title: string;
  payload: unknown;
}) {
  const render = RENDERERS[taskType];
  if (!render) {
    return <p className="text-sm text-almi-text-muted">This task isn&apos;t available yet.</p>;
  }
  return <>{render({ attemptId, prompt, title, payload })}</>;
}
