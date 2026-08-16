"use client";

// Per-row comp controls for /admin/accounts.
//
// The email comes from the ROW, never from a typed field — the old flow made an
// admin retype an address they were already looking at, which is both slower and
// a way to comp the wrong person.
//
// Every mutation calls the EXISTING gated server actions in
// src/lib/admin/comp-accounts.ts. No comp logic is reimplemented here: this file
// decides layout and nothing else. Errors render on the row that produced them,
// so a failure is attached to the user it concerns rather than floating at the
// top of the page.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantCompPro, extendCompPro, revokeCompPro } from "@/lib/admin/comp-accounts";

const MAX_DAYS = 1825; // mirrors validDays() in the server action

export function AccountCompControls({
  userId,
  email,
  comped,
  daysRemaining,
}: {
  userId: string;
  email: string;
  comped: boolean;
  daysRemaining: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("90");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The shared actions revalidate /admin/comp-accounts, not this page, so the
  // view is refreshed explicitly after every successful write.
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(res.error ?? "Action failed.");
      }
    });
  }

  const btn =
    "rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 whitespace-nowrap";

  return (
    <div className="space-y-2">
      {comped ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-almi-text-muted">{daysRemaining ?? 0} d left</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => extendCompPro({ userId, additionalDays: 30 }))}
            className={`${btn} border-almi-ink/15 text-almi-ink hover:border-almi-coral`}
          >
            +30 d
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Revoke comp Pro for ${email}? They lose Pro access immediately.`)) return;
              run(() => revokeCompPro({ userId }));
            }}
            className={`${btn} border-almi-coral/40 text-almi-coral-deep hover:bg-almi-coral/10`}
          >
            Revoke
          </button>
        </div>
      ) : open ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={MAX_DAYS}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label={`Days of comp Pro for ${email}`}
            className="w-20 rounded-md border border-almi-ink/15 bg-almi-bg px-2 py-1 text-xs text-almi-ink focus:border-almi-coral focus:outline-none"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label={`Reason for comping ${email}`}
            className="w-40 rounded-md border border-almi-ink/15 bg-almi-bg px-2 py-1 text-xs text-almi-ink focus:border-almi-coral focus:outline-none"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => grantCompPro({ email, days: Number(days), reason: reason || undefined }),
                () => {
                  setOpen(false);
                  setReason("");
                  setDays("90");
                },
              )
            }
            className={`${btn} border-almi-coral bg-almi-coral text-almi-ink hover:bg-almi-coral-deep`}
          >
            {pending ? "Working…" : "Grant"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className={`${btn} border-almi-ink/15 text-almi-text-muted hover:border-almi-ink/30`}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(true)}
          className={`${btn} border-almi-ink/15 text-almi-ink hover:border-almi-coral`}
        >
          Comp…
        </button>
      )}

      {error && <p className="text-xs font-medium text-almi-coral-deep">{error}</p>}
    </div>
  );
}
