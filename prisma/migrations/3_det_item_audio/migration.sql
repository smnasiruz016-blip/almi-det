-- Pre-rendered TTS audio, one row per audio segment of a DetItem.
-- Hand-written (not `prisma migrate dev`) to avoid the Neon shadow-database
-- flake; apply with `prisma migrate deploy`.
--
-- `seg` is 0 for single-clip tasks (Listen and Type) and 0..N for multi-clip
-- conversations (Interactive Listening, when it lands), so that task type needs
-- no further migration.
CREATE TABLE "DetItemAudio" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seg" INTEGER NOT NULL DEFAULT 0,
    "audioUrl" TEXT NOT NULL DEFAULT '',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "chars" INTEGER NOT NULL DEFAULT 0,
    "voice" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DetItemAudio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DetItemAudio_itemId_seg_key" ON "DetItemAudio"("itemId", "seg");
CREATE INDEX "DetItemAudio_itemId_idx" ON "DetItemAudio"("itemId");
ALTER TABLE "DetItemAudio" ADD CONSTRAINT "DetItemAudio_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
