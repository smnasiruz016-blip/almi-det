"use client";

import { useMemo, useState } from "react";

export type AdminReviewRow = {
  id: string;
  rating: number;
  text: string;
  approved: boolean;
  createdAt: string; // ISO
  userName: string | null;
  userEmail: string | null;
};

type Filter = "All" | "Pending" | "Approved";

export function AdminReviews({ rows: initialRows }: { rows: AdminReviewRow[] }) {
  const [rows, setRows] = useState<AdminReviewRow[]>(initialRows);
  const [filter, setFilter] = useState<Filter>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approvedCount = rows.filter((r) => r.approved).length;

  const filtered = useMemo(() => {
    if (filter === "Pending") return rows.filter((r) => !r.approved);
    if (filter === "Approved") return rows.filter((r) => r.approved);
    return rows;
  }, [rows, filter]);

  async function toggle(row: AdminReviewRow) {
    const next = !row.approved;
    setBusyId(row.id);
    setError(null);
    // Optimistic — revert on failure.
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, approved: next } : r)));
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, approved: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, approved: row.approved } : r)));
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-almi-teal">Admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-almi-ink">Reviews</h1>
        <p className="mt-1 text-sm text-almi-text-muted">
          Approve testimonials. Reviews are unapproved by default, and editing a
          review resets it to pending.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-almi-bg-peach px-3 py-1 text-sm font-semibold text-almi-ink">
          {approvedCount} / {rows.length} approved
        </span>
        {error && <span className="text-xs text-almi-coral-deep">{error}</span>}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {(["All", "Pending", "Approved"] as const).map((f) => {
          const count =
            f === "All" ? rows.length : rows.filter((r) => (f === "Approved" ? r.approved : !r.approved)).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                "rounded-md px-3 py-1.5 " +
                (f === filter
                  ? "bg-almi-coral font-semibold text-almi-ink"
                  : "border border-almi-bg-peach text-almi-text hover:border-almi-coral")
              }
            >
              {f} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-almi-text-muted">No reviews in this filter.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm leading-none" aria-label={`${r.rating} of 5 stars`}>
                      <span aria-hidden className="text-almi-coral">{"★".repeat(Math.max(0, Math.min(5, r.rating)))}</span>
                      <span aria-hidden className="text-almi-bg-peach">{"★".repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                    </span>
                    {r.approved ? (
                      <span className="rounded bg-almi-teal/15 px-1.5 py-0.5 text-[11px] font-semibold text-almi-teal">
                        ✓ Approved
                      </span>
                    ) : (
                      <span className="rounded bg-almi-bg-peach px-1.5 py-0.5 text-[11px] font-semibold text-almi-text-muted">
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-almi-text">{r.text}</p>
                  <p className="mt-2 text-xs text-almi-text-muted">
                    {r.userName?.trim() || "No name"}
                    {r.userEmail ? ` · ${r.userEmail}` : ""} · {r.createdAt.slice(0, 10)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  disabled={busyId === r.id}
                  className={
                    "flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60 " +
                    (r.approved
                      ? "border border-almi-bg-peach text-almi-text hover:border-almi-coral"
                      : "bg-almi-coral text-almi-ink hover:bg-almi-coral-deep")
                  }
                >
                  {busyId === r.id ? "Saving…" : r.approved ? "Unapprove" : "Approve"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
