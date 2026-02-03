-- AlterTable
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastActivityType" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastActivitySummary" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastActivityUserId" TEXT;
