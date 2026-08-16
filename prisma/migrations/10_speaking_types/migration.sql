-- The three AI-graded speaking types, on top of the speaking kernel.
--
-- All three transcribe and then rate the TRANSCRIPT against a server-only
-- rubric reference. They add no columns: the paid gate, the per-user daily cap
-- and the AICostLedger metering already exist, and LISTEN_THEN_SPEAK's spoken
-- question reuses DetItemAudio exactly as Interactive Listening does.
--
-- LISTEN_THEN_SPEAK is the one whose stimulus is withheld: the question is
-- delivered as audio and its TEXT is never projected, so a taker who cannot hear
-- it cannot read it instead. That is a projection rule, not a schema one.
--
-- Hand-written rather than `prisma migrate dev` (Neon shadow-database flake);
-- applied with `prisma migrate deploy`.
--
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction provided
-- the new label is not USED in the same transaction. This migration only adds
-- the labels; seeding runs separately.
ALTER TYPE "DetTaskType" ADD VALUE IF NOT EXISTS 'READ_THEN_SPEAK';
ALTER TYPE "DetTaskType" ADD VALUE IF NOT EXISTS 'LISTEN_THEN_SPEAK';
ALTER TYPE "DetTaskType" ADD VALUE IF NOT EXISTS 'SPEAKING_SAMPLE';
