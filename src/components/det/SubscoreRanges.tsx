// Shared honest subscore-range cards. Used by both the single-attempt result
// and the session aggregate. Each card is a 10–160 range (never a single
// number); provisional = only one of the subscore's two skills has evidence.

import type { SubscoreEstimate, SubscoreKey } from "@/lib/det/types";
import { SUBSCORE_KEYS, SUBSCORE_LABEL, SUBSCORE_MEANING } from "@/lib/det/types";
import { cefrHint, formatRange, rangeMidpoint } from "@/lib/det/scale";

export function SubscoreRanges({
  estimate,
  provisional,
}: {
  estimate: SubscoreEstimate;
  provisional: Set<SubscoreKey>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SUBSCORE_KEYS.map((k) => {
        const range = estimate[k];
        return (
          <div key={k} className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-almi-ink">{SUBSCORE_LABEL[k]}</h3>
              {range && (
                <span className="rounded-full bg-almi-accent/15 px-2 py-0.5 text-xs font-semibold text-almi-accent-deep">
                  CEFR {cefrHint(rangeMidpoint(range))}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-almi-text-muted">{SUBSCORE_MEANING[k]}</p>
            {range ? (
              <>
                <p className="mt-3 text-2xl font-bold text-almi-coral-deep">{formatRange(range)}</p>
                <p className="mt-1 text-xs text-almi-text-muted">
                  {provisional.has(k)
                    ? "Provisional — practise the partner skill to complete this subscore."
                    : "Practice estimate on the 10–160 scale."}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-almi-text-muted">Not practised yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
