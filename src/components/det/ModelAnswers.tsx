// RR-401 · model answers for a factory item, shown on the result AFTER the learner has answered (never before: the answer would be
// a leak). Server component. Every level the pack gives (130+, 110, 85), each with its notes; the 85 level is labelled as having
// mistakes on purpose. No scoring is invented here: the levels are the pack's estimates, labelled as such.

import { modelAnswersFor, MODEL_DATA } from "@/lib/factory/model-answers";

/** "*italic*" in a note is a cited phrase: shown in italics, with no other markdown */
function Note({ text }: { text: string }) {
  const bits = text.split(/(\*[^*\n]+\*)/g);
  return <>{bits.map((b, i) => (/^\*[^*\n]+\*$/.test(b) ? <em key={i}>{b.slice(1, -1)}</em> : <span key={i}>{b}</span>))}</>;
}

export function ModelAnswers({ taskType, title }: { taskType: string; title: string }) {
  const item = modelAnswersFor(taskType, title);
  if (!item) return null;
  return (
    <section className="rounded-2xl border border-almi-bg-peach bg-almi-bg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-almi-text-muted">Model answers</h2>
      <p className="mt-1 text-xs text-almi-text-muted">{MODEL_DATA.label}.</p>
      <div className="mt-3 space-y-4">
        {item.answers.map((a) => (
          <div key={a.level} className="rounded-lg border border-almi-bg-peach bg-almi-paper px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
              Level {a.level}
              {a.withMistakes ? " · with mistakes on purpose" : ""} · {a.wordCount} words
            </p>
            <div className="mt-2 space-y-2 text-sm text-almi-text">
              {a.parts.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {p.label ? <strong>{p.label}: </strong> : null}
                  {p.text}
                </p>
              ))}
            </div>
            {(a.notes ?? (a === item.answers[item.answers.length - 1] ? item.sharedNotes : null)) && (
              <p className="mt-2 text-xs text-almi-text-muted">
                <strong>Notes: </strong>
                <Note text={(a.notes ?? item.sharedNotes)!} />
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-almi-text-muted">{MODEL_DATA.trademark}</p>
    </section>
  );
}
