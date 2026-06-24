import type { User } from "@prisma/client";
import { isOwner } from "@/lib/auth/owner-check";

// Price IDs are sourced from env — founder sets them in Vercel after creating
// the "AlmiDET Pro" product in the shared AlmiWorld Stripe account.
// Until set, billing is disabled at runtime by isBillingEnabled().
export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY ?? "";
export const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY ?? "";

export type PlanKey = "FREE" | "PRO_MONTHLY" | "PRO_YEARLY";

export type PlanConfig = {
  /** Practice attempts per month — Infinity = unlimited. */
  attemptsPerMonth: number;
  /** AI-evaluated productive tasks per month — Infinity = unlimited. */
  aiEvaluationsPerMonth: number;
  /** Access to all DET task types vs. a limited preview. */
  allTasks: boolean;
};

export const PLANS: Record<PlanKey, PlanConfig> = {
  FREE: {
    attemptsPerMonth: 3,
    aiEvaluationsPerMonth: 1,
    allTasks: false,
  },
  PRO_MONTHLY: {
    attemptsPerMonth: Infinity,
    aiEvaluationsPerMonth: Infinity,
    allTasks: true,
  },
  PRO_YEARLY: {
    attemptsPerMonth: Infinity,
    aiEvaluationsPerMonth: Infinity,
    allTasks: true,
  },
};

export const PLAN_DISPLAY_NAME: Record<PlanKey, string> = {
  FREE: "Free",
  PRO_MONTHLY: "Pro Monthly",
  PRO_YEARLY: "Pro Yearly",
};

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

type ProUserShape = Pick<
  User,
  "subscriptionStatus" | "subscriptionCurrentPeriodEnd"
>;

/**
 * True when the user has Pro access right now — paid or trialing subscription
 * still inside its period. Past-due / canceled / incomplete = false.
 */
export function isProActive(user: ProUserShape): boolean {
  if (!user.subscriptionStatus) return false;
  if (!ACTIVE_STATUSES.has(user.subscriptionStatus)) return false;
  if (!user.subscriptionCurrentPeriodEnd) return false;
  return user.subscriptionCurrentPeriodEnd.getTime() > Date.now();
}

/** Email verification check. Paid features require both verified email AND
 *  active subscription — see hasPaidAccess(). */
export function isEmailVerified(user: Pick<User, "emailVerified">): boolean {
  return user.emailVerified !== null;
}

/** Gate for paid features: an OWNER always has access; otherwise requires an
 *  active subscription AND verified email. Owner override is the single
 *  chokepoint — every free-tier limit (objective + productive DET tasks) and
 *  the "free plan" UI banner derive from this. */
export function hasPaidAccess(
  user: ProUserShape & Pick<User, "emailVerified" | "email">,
): boolean {
  if (isOwner(user.email)) return true;
  return isProActive(user) && isEmailVerified(user);
}

export function getUserPlan(
  user: ProUserShape & Pick<User, "subscriptionPlan">,
): PlanKey {
  if (!isProActive(user)) return "FREE";
  if (user.subscriptionPlan === "pro_yearly") return "PRO_YEARLY";
  return "PRO_MONTHLY";
}

/**
 * Convert a Stripe Price ID to our internal plan label. Server-side
 * validation: any priceId outside this map is rejected at the checkout API.
 */
export function priceIdToPlanLabel(
  priceId: string,
): "pro_monthly" | "pro_yearly" | null {
  if (priceId && priceId === STRIPE_PRICE_MONTHLY) return "pro_monthly";
  if (priceId && priceId === STRIPE_PRICE_YEARLY) return "pro_yearly";
  return null;
}

/**
 * Dry-run guard. Billing is enabled only when:
 *   1. NEXT_PUBLIC_BILLING_ENABLED === "true", AND
 *   2. The monthly Stripe price ID is configured.
 * AlmiDET ships a single $12/month plan — there is no yearly price, so the
 * yearly scaffolding below stays dormant (STRIPE_PRICE_YEARLY === "" makes
 * priceIdToPlanLabel + the checkout allowlist reject any "yearly" request).
 * Webhook endpoint still processes events when disabled (so we can verify
 * the integration end-to-end with test transactions).
 */
export function isBillingEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_BILLING_ENABLED === "true" &&
    Boolean(STRIPE_PRICE_MONTHLY)
  );
}
