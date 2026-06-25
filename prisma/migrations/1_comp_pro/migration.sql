-- Comp Pro access — admin-granted Pro without Stripe, with an expiry.
-- Additive only: four NULLABLE columns + one index on "User". No existing data
-- is read, rewritten, or dropped, so this is safe to `migrate deploy` against
-- the production Neon database (ADD COLUMN nullable is metadata-only on Postgres).

ALTER TABLE "User"
  ADD COLUMN "compProUntil"  TIMESTAMP(3),
  ADD COLUMN "compGrantedAt" TIMESTAMP(3),
  ADD COLUMN "compGrantedBy" TEXT,
  ADD COLUMN "compReason"    TEXT;

CREATE INDEX "User_compProUntil_idx" ON "User"("compProUntil");
