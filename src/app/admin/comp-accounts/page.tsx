import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/founder";
import { listCompAccounts } from "@/lib/admin/comp-accounts";
import { CompAccountsClient } from "./comp-accounts-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comp accounts — Admin",
  robots: { index: false, follow: false },
};

export default async function CompAccountsPage() {
  // Re-gated independently of the layout — defence in depth.
  const user = await requireUser();
  if (!isAdmin(user.email)) redirect("/");

  const { active, expired } = await listCompAccounts();
  return <CompAccountsClient active={active} expired={expired} />;
}
