"use client";

// Comp Accounts — the grants AUDIT TRAIL: every comp ever issued, active and
// expired, with its reason and who granted it. None of that history is visible
// on /admin/accounts, which shows current status only.
//
// Granting moved to /admin/accounts, where the row already knows the email. The
// form that used to live here asked an admin to retype an address they were
// looking at, which is slower and a way to comp the wrong person.
//
// Extend and Revoke stay, because they are the only way to act on an EXPIRED
// grant: extendCompPro() tops up in place and preserves the original
// compGrantedAt / compGrantedBy / compReason, whereas re-granting from the
// accounts table would reset that provenance. Both call the same gated server
// actions; nothing is reimplemented here.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeCompPro, extendCompPro, type CompRow } from "@/lib/admin/comp-accounts";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function CompAccountsClient({
  active,
  expired,
}: {
  active: CompRow[];
  expired: CompRow[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function extend(userId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await extendCompPro({ userId, additionalDays: 30 });
      if (res.ok) router.refresh();
      else setMsg({ ok: false, text: res.error ?? "Could not extend." });
    });
  }

  function revoke(userId: string, who: string) {
    if (!window.confirm(`Revoke comp Pro for ${who}? They lose Pro access immediately.`)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await revokeCompPro({ userId });
      if (res.ok) router.refresh();
      else setMsg({ ok: false, text: res.error ?? "Could not revoke." });
    });
  }

  const rows = [...active, ...expired];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-almi-bg-peach bg-almi-bg px-4 py-3">
        <p className="text-sm text-almi-text-muted">
          Every comp grant, active and expired. To <strong>grant</strong> a new comp, use the Comp
          column on{" "}
          <a href="/admin/accounts" className="font-medium text-almi-coral hover:underline">
            Accounts
          </a>{" "}
          — the row already knows the email.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-almi-ink">Comp grants</h2>
          <p className="text-xs text-almi-text-muted">
            {active.length} active · {expired.length} expired
          </p>
        </div>

        {msg && (
          <p
            className={`mt-3 text-sm font-medium ${
              msg.ok ? "text-almi-teal" : "text-almi-coral-deep"
            }`}
          >
            {msg.text}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-almi-bg-peach bg-almi-bg px-4 py-6 text-center text-sm text-almi-text-muted">
            No comp grants yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-almi-bg-peach">
            <table className="w-full text-left text-sm">
              <thead className="bg-almi-bg text-xs uppercase tracking-wide text-almi-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Granted</th>
                  <th className="px-4 py-3 font-semibold">Expires</th>
                  <th className="px-4 py-3 font-semibold">Days left</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Granted by</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-almi-bg-peach bg-almi-paper">
                {rows.map((r) => (
                  <tr key={r.userId} className={r.isActive ? "" : "opacity-60"}>
                    <td className="px-4 py-3 text-almi-ink">{r.email}</td>
                    <td className="px-4 py-3 text-almi-text-muted">{fmtDate(r.grantedAt)}</td>
                    <td className="px-4 py-3 text-almi-text-muted">{fmtDate(r.expiresAt)}</td>
                    <td className="px-4 py-3">
                      {r.isActive ? (
                        <span className="font-semibold text-almi-ink">{r.daysRemaining} d</span>
                      ) : (
                        <span className="rounded-full bg-almi-bg-peach px-2 py-0.5 text-xs font-semibold text-almi-text-muted">
                          expired
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-almi-text-muted">{r.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-almi-text-muted">{r.grantedBy ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => extend(r.userId)}
                          disabled={pending}
                          className="rounded-md border border-almi-ink/15 px-2.5 py-1 text-xs font-semibold text-almi-ink hover:border-almi-coral disabled:opacity-50"
                        >
                          +30 d
                        </button>
                        {r.isActive && (
                          <button
                            type="button"
                            onClick={() => revoke(r.userId, r.email)}
                            disabled={pending}
                            className="rounded-md border border-almi-coral/40 px-2.5 py-1 text-xs font-semibold text-almi-coral-deep hover:bg-almi-coral/10 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
