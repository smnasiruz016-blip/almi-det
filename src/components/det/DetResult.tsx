// Honest results surface. Shows the four DET subscores as practice-estimate
// RANGES (never a single number, never a fabricated overall), a readiness band
// label, the per-task review, and the standing "practice estimate" disclaimer.
//
// `variant="single"` is a standalone attempt; `variant="step"` is one step
// inside a session (subscore cards + disclaimer are shown once at the session
// aggregate instead). The per-task review components are exported for reuse by
// the session aggregate.

import Link from "next/link";
import type { DetAttempt, DetItem } from "@prisma/client";
import type { DetSkill, SubscoreEstimate } from "@/lib/det/types";
import { overallReadiness } from "@/lib/det/subscores";
import type { TaskDef } from "@/lib/det/registry";
import { DET_TASKS } from "@/lib/det/registry";
import { SubscoreRanges } from "@/components/det/SubscoreRanges";
import {
  readAndSelectPayloadSchema,
  readAndSelectResponseSchema,
  scoreReadAndSelect,
} from "@/lib/det/tasks/read-and-select";
import {
  listenAndTypePayloadSchema,
  listenAndTypeResponseSchema,
  scoreListenAndType,
} from "@/lib/det/tasks/listen-and-type";
import type { WriteAboutPhotoFeedback } from "@/lib/det/tasks/write-about-the-photo";
import type { SpeakAboutPhotoFeedback } from "@/lib/det/tasks/speak-about-the-photo";

const EMPTY_ESTIMATE: SubscoreEstimate = {
  literacy: null,
  comprehension: null,
  conversation: null,
  production: null,
};

function ReadAndSelectReview({ item, attempt }: { item: DetItem; attempt: DetAttempt }) {
  const payload = readAndSelectPayloadSchema.safeParse(item.payload);
  const response = readAndSelectResponseSchema.safeParse(attempt.response);
  if (!payload.success || !response.success) return null;
  const { detail } = scoreReadAndSelect(payload.data, response.data);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {detail.words.map((w) => (
        <div
          key={w.id}
          className={`rounded-lg border px-3 py-2 text-sm ${
            w.correct ? "border-almi-teal/40 bg-almi-teal/5" : "border-almi-coral/40 bg-almi-coral/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-almi-ink">{w.text}</span>
            <span aria-hidden>{w.correct ? "✓" : "✗"}</span>
          </div>
          <p className="text-xs text-almi-text-muted">
            {w.real ? "Real word" : "Not a word"}
            {w.picked !== w.real && (w.real ? " · you missed it" : " · you marked it")}
          </p>
        </div>
      ))}
    </div>
  );
}

function ListenAndTypeReview({ item, attempt }: { item: DetItem; attempt: DetAttempt }) {
  const payload = listenAndTypePayloadSchema.safeParse(item.payload);
  const response = listenAndTypeResponseSchema.safeParse(attempt.response);
  if (!payload.success || !response.success) return null;
  const { detail } = scoreListenAndType(payload.data, response.data);
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-teal">The sentence</p>
        <p className="mt-1 text-almi-ink">{detail.sentence}</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-text-muted">What you typed</p>
        <p className="mt-1 text-almi-text">{detail.typed || "(nothing)"}</p>
      </div>
      <p className="text-xs text-almi-text-muted">
        {detail.matched} of {detail.total} words matched (case, punctuation and small typos forgiven).
      </p>
    </div>
  );
}

const WRITE_TRAIT_LABEL: Record<string, string> = {
  taskRelevance: "Describes the photo",
  rangeAndAccuracy: "Range & accuracy",
  clarity: "Clarity",
};

function WritePhotoReview({ attempt }: { attempt: DetAttempt }) {
  const fb = attempt.feedback as WriteAboutPhotoFeedback | null;
  if (!fb) return null;
  const traits: [string, string][] = [
    ["taskRelevance", fb.taskRelevance],
    ["rangeAndAccuracy", fb.rangeAndAccuracy],
    ["clarity", fb.clarity],
  ];
  return <TraitFeedback traits={traits} labels={WRITE_TRAIT_LABEL} fb={fb} />;
}

const SPEAK_TRAIT_LABEL: Record<string, string> = {
  contentRelevance: "Talks about the scene",
  fluencyOnTopic: "Flow (from transcript)",
  rangeAndAccuracy: "Range & accuracy",
};

function SpeakPhotoReview({ attempt }: { attempt: DetAttempt }) {
  const fb = attempt.feedback as SpeakAboutPhotoFeedback | null;
  if (!fb) return null;
  const transcript = (attempt.response as { transcript?: string } | null)?.transcript;
  const traits: [string, string][] = [
    ["contentRelevance", fb.contentRelevance],
    ["fluencyOnTopic", fb.fluencyOnTopic],
    ["rangeAndAccuracy", fb.rangeAndAccuracy],
  ];
  return (
    <div className="space-y-4">
      <TraitFeedback traits={traits} labels={SPEAK_TRAIT_LABEL} fb={fb} />
      {transcript && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-almi-text-muted">
            Transcript (estimated, not acoustic)
          </p>
          <p className="mt-1 text-sm text-almi-text">{transcript}</p>
        </div>
      )}
    </div>
  );
}

function TraitFeedback({
  traits,
  labels,
  fb,
}: {
  traits: [string, string][];
  labels: Record<string, string>;
  fb: { strengths: string[]; improvements: string[]; overallComment: string };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {traits.map(([k, level]) => (
          <div key={k} className="rounded-lg border border-almi-bg-peach bg-almi-paper px-3 py-2">
            <p className="text-xs text-almi-text-muted">{labels[k]}</p>
            <p className="text-sm font-semibold capitalize text-almi-ink">{level}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-almi-text">{fb.overallComment}</p>
      {fb.strengths.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-almi-teal">What worked</p>
          <ul className="mt-1 space-y-1 text-sm text-almi-text">
            {fb.strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-almi-teal">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {fb.improvements.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
            Improvement opportunities
          </p>
          <ul className="mt-1 space-y-1 text-sm text-almi-text">
            {fb.improvements.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-almi-accent-deep">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TaskReview({ item, attempt }: { item: DetItem; attempt: DetAttempt }) {
  switch (attempt.taskType) {
    case "READ_AND_SELECT":
      return <ReadAndSelectReview item={item} attempt={attempt} />;
    case "LISTEN_AND_TYPE":
      return <ListenAndTypeReview item={item} attempt={attempt} />;
    case "WRITE_ABOUT_THE_PHOTO":
      return <WritePhotoReview attempt={attempt} />;
    case "SPEAK_ABOUT_THE_PHOTO":
      return <SpeakPhotoReview attempt={attempt} />;
    default:
      return null;
  }
}

export function DetResult({
  def,
  item,
  attempt,
  variant = "single",
}: {
  def: TaskDef;
  item: DetItem;
  attempt: DetAttempt;
  variant?: "single" | "step";
}) {
  const estimate = (attempt.subscoreEstimate as SubscoreEstimate | null) ?? EMPTY_ESTIMATE;
  const readiness = overallReadiness(estimate);
  const provisional = new Set(DET_TASKS[attempt.taskType].feedsSubscores);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          {def.label} · practice result
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-almi-ink">
          {variant === "step" ? "This question" : "Your practice estimate"}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {variant === "single" && readiness && (
            <span className="rounded-full bg-almi-coral/10 px-3 py-1 text-sm font-semibold text-almi-coral-deep">
              {readiness}
            </span>
          )}
          <span className="text-sm text-almi-text-muted">
            {attempt.pointsEarned} / {attempt.pointsMax} practice points
          </span>
        </div>
      </header>

      {variant === "single" && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">
            Subscore estimates (10–160 scale)
          </h2>
          <div className="mt-3">
            <SubscoreRanges estimate={estimate} provisional={provisional} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">Review</h2>
        <div className="mt-3">
          <TaskReview item={item} attempt={attempt} />
        </div>
      </section>

      {variant === "single" && (
        <>
          <p className="rounded-xl border border-almi-bg-peach bg-almi-paper px-4 py-3 text-xs text-almi-text-muted">
            This is a practice estimate to guide your prep — not an official Duolingo English Test
            result. We show a range, not a single number, because honest prep means showing the
            uncertainty. Your real score comes only from an official test.
          </p>
          <Link
            href={`/practice/${def.slug}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-almi-coral px-6 py-3 text-sm font-semibold text-almi-ink hover:bg-almi-coral-deep"
          >
            Practise again →
          </Link>
        </>
      )}
    </div>
  );
}
