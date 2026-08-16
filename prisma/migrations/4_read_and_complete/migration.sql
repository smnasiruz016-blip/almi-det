-- Read and Complete (cloze) — the second Reading task type.
--
-- Hand-written rather than `prisma migrate dev`, to avoid the Neon shadow-database
-- flake; applied with `prisma migrate deploy`.
--
-- Postgres 12+ allows ALTER TYPE ... ADD VALUE inside a transaction as long as the
-- new value is not USED in the same transaction. This migration only adds the
-- label; seeding happens later, in a separate connection. (Verified: the target
-- database is PostgreSQL 17.10.)
ALTER TYPE "DetTaskType" ADD VALUE IF NOT EXISTS 'READ_AND_COMPLETE';
