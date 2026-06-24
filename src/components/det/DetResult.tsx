// Honest results surface. Shows the four DET subscores as practice-estimate
// RANGES (never a single number, never a fabricated overall), a readiness band
// label, the per-task review, and the standing "practice estimate" disclaimer.

import Link from "next/link";
import type { DetAttempt, DetItem } from "@prisma/client";
import type { DetSkill, SubscoreEstimate, SubscoreKey } from "@/lib/det/types";
import { SUBSCORE_KEYS, SUBSCORE_LABEL, SUBSCORE_MEANING } from "@/lib/det/types";
import { cefrHint, formatRange, rangeMidpoint } from "@/lib/det/scale";
import { overallReadiness, SUBSCORE_SKILLS } from "@/lib/det/subscores";
import type { TaskDef } from "@/lib/det/registry";
import {
  readAndSelectPayloadSchema,
  readAndSelectResponseSchema,
  scoreReadAndSelect,
} from "@/lib/det/tasks/read-and-select";
import type { WriteAboutPhotoFeedback } from "@/lib/det/tasks/write-about-the-photo";

const SKILL_LABEL: Record<DetSkill, string> = {
  READING: "Reading",
  WRITING: "Writing",
  LISTENING: "Listening",
  SPEAKING: "Speaking",
};

const EMPTY_ESTIMATE: SubscoreEstimate = {
  literacy: null,
  comprehension: null,
  conversation: null,
  production: null,
};

function partnerSkill(key: SubscoreKey, skill: DetSkill): DetSkill {
  const [a, b] = SUBSCORE_SKILLS[key];
  return a === skill ? b : a;
}

function SubscoreCard({
  keyName,
  estimate,
  fedSkill,
}: {
  keyName: SubscoreKey;
  estimate: SubscoreEstimate;
  fedSkill: DetSkill;
}) {
  const range = estimate[keyName];
  const fed = range !== null;
  return (
    <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-almi-ink">{SUBSCORE_LABEL[keyName]}</h3>
        {fed && range && (
          <span className="rounded-full bg-almi-accent/15 px-2 py-0.5 text-xs font-semibold text-almi-accent-deep">
            CEFR {cefrHint(rangeMidpoint(range))}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-almi-text-muted">{SUBSCORE_MEANING[keyName]}</p>
      {fed && range ? (
        <>
          <p className="mt-3 text-2xl font-bold text-almi-coral-deep">{formatRange(range)}</p>
          <p className="mt-1 text-xs text-almi-text-muted">
            Practice estimate · based on {SKILL_LABEL[fedSkill]} only — practise{" "}
            {SKILL_LABEL[partnerSkill(keyName, fedSkill)]} to complete this subscore.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-almi-text-muted">Not practised yet.</p>
      )}
    </div>
  );
}

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
            w.correct
              ? "border-almi-teal/40 bg-almi-teal/5"
              : "border-almi-coral/40 bg-almi-coral/5"
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

const TRAIT_LABEL: Record<string, string> = {
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {traits.map(([k, level]) => (
          <div key={k} className="rounded-lg border border-almi-bg-peach bg-almi-paper px-3 py-2">
            <p className="text-xs text-almi-text-muted">{TRAIT_LABEL[k]}</p>
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

export function DetResult({
  def,
  item,
  attempt,
}: {
  def: TaskDef;
  item: DetItem;
  attempt: DetAttempt;
}) {
  const estimate = (attempt.subscoreEstimate as SubscoreEstimate | null) ?? EMPTY_ESTIMATE;
  const readiness = overallReadiness(estimate);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
          {def.label} · practice result
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-almi-ink">Your practice estimate</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {readiness && (
            <span className="rounded-full bg-almi-coral/10 px-3 py-1 text-sm font-semibold text-almi-coral-deep">
              {readiness}
            </span>
          )}
          <span className="text-sm text-almi-text-muted">
            {attempt.pointsEarned} / {attempt.pointsMax} practice points
          </span>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">
          Subscore estimates (10–160 scale)
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SUBSCORE_KEYS.map((k) => (
            <SubscoreCard key={k} keyName={k} estimate={estimate} fedSkill={def.skill} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">
          Review
        </h2>
        <div className="mt-3">
          {def.taskType === "READ_AND_SELECT" ? (
            <ReadAndSelectReview item={item} attempt={attempt} />
          ) : def.taskType === "WRITE_ABOUT_THE_PHOTO" ? (
            <WritePhotoReview attempt={attempt} />
          ) : null}
        </div>
      </section>

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
    </div>
  );
}
