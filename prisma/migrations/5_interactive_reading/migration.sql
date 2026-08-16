-- Interactive Reading — one passage plus ~6 selection-based sub-questions.
--
-- Hand-written rather than `prisma migrate dev` (Neon shadow-database flake);
-- applied with `prisma migrate deploy`.
--
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction provided
-- the new label is not USED in the same transaction. This migration only adds
-- the label; seeding runs separately. (Target verified: PostgreSQL 17.10.)
ALTER TYPE "DetTaskType" ADD VALUE IF NOT EXISTS 'INTERACTIVE_READING';
