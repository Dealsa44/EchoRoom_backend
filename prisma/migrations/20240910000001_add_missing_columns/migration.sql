-- Add missing columns to users table
ALTER TABLE "users" ADD COLUMN "safeMode" TEXT NOT NULL DEFAULT 'light';
ALTER TABLE "users" ADD COLUMN "anonymousMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "aiAssistant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "verificationCode" TEXT;

-- Update existing rows to have default values
UPDATE "users" SET "safeMode" = 'light' WHERE "safeMode" IS NULL;
UPDATE "users" SET "anonymousMode" = false WHERE "anonymousMode" IS NULL;
UPDATE "users" SET "aiAssistant" = false WHERE "aiAssistant" IS NULL;
