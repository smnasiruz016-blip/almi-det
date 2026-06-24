// Task start page: shows the task intro, then opens a fresh attempt on a
// random active item and routes into it. The "Begin" form posts to a
// module-level server action (the slug travels in a hidden field).

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { startAttempt } from "@/lib/det/attempts";
import { taskBySlug } from "@/lib/det/registry";
import { SUBSCORE_LABEL } from "@/lib/det/types";

async function beginAction(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "");
  const def = taskBySlug(slug);
  if (!def || !def.live) redirect("/practice");
  const user = await requireUser();
  const id = await startAttempt(user.id, def.taskType);
  if (!id) redirect(`/practice/${def.slug}?empty=1`);
  redirect(`/practice/${def.slug}/${id}`);
}

export default async function TaskStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ task: string }>;
  searchParams: Promise<{ empty?: string }>;
}) {
  await requireUser();
  const { task } = await params;
  const { empty } = await searchParams;
  const def = taskBySlug(task);
  if (!def || !def.live) notFound();

  const subs = def.feedsSubscores.map((s) => SUBSCORE_LABEL[s]).join(" + ");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-xs font-bold uppercase tracking-wider text-almi-accent-deep">
        AlmiDET practice
      </p>
      <h1 className="text-3xl font-semibold text-almi-ink">{def.label}</h1>
      <p className="text-base text-almi-text">{def.blurb}</p>

      <div className="rounded-2xl border border-almi-bg-peach bg-almi-paper p-5 text-sm text-almi-text">
        <p>
          <span className="font-semibold text-almi-ink">Scoring:</span>{" "}
          {def.scoringMode === "AI"
            ? "honest AI trait feedback, turned into a practice range."
            : "auto-marked instantly, turned into a practice range."}
        </p>
        <p className="mt-2">
          <span className="font-semibold text-almi-ink">Informs:</span> {subs} (on the 10–160 scale).
        </p>
      </div>

      {empty && (
        <p className="rounded-xl border border-almi-coral/40 bg-almi-coral/5 px-4 py-3 text-sm text-almi-coral-deep">
          No practice items are seeded for this task yet.
        </p>
      )}

      <form action={beginAction}>
        <input type="hidden" name="slug" value={def.slug} />
        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-almi-coral px-7 py-3 text-base font-semibold text-almi-ink hover:bg-almi-coral-deep"
        >
          Begin practice →
        </button>
      </form>

      <p className="text-xs text-almi-text-muted">
        Original to AlmiDET — never copied from Duolingo. Results are a practice estimate, not an
        official Duolingo English Test result.
      </p>
    </div>
  );
}
