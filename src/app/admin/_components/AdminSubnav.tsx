"use client";

// Admin tab strip. Accounts is the action surface; Comp Accounts is the grants
// audit trail; Costs reads AICostLedger.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Comp Accounts", href: "/admin/comp-accounts" },
  { label: "Accounts", href: "/admin/accounts" },
  { label: "Costs", href: "/admin/costs" },
  { label: "Reviews", href: "/admin/reviews" },
];

export function AdminSubnav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-1 border-b border-almi-bg-peach">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? "border-almi-coral text-almi-ink"
                : "border-transparent text-almi-text-muted hover:text-almi-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
