-- Fill in the Blanks — sentence-scope cloze, exactly one gap per item.
--
-- Distinct from READ_AND_COMPLETE, which is passage-scope with many gaps. Same
-- payload shape and the same grader; the difference is scope, and the gate
-- enforces it (exactly one blank, and a single self-contained sentence).
--
-- Hand-written (Neon shadow-database flake); applied with `prisma migrate deploy`.
-- Postgres 12+ allows ALTER TYPE ... ADD VALUE in a transaction provided the new
-- label is not USED in the same transaction; seeding runs separately.
ALTER TYPE "DetTaskType" ADD VALUE IF NOT EXISTS 'FILL_IN_THE_BLANKS';
