-- AlterTable
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "chatTheme" TEXT DEFAULT 'default';
