/*
  Warnings:

  - You are about to drop the column `deliveryStatus` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `hasErrors` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `isEncrypted` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `room_members` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `chat_messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "user_interests_userId_interest_key";

-- DropIndex
DROP INDEX "user_languages_userId_code_key";

-- AlterTable
ALTER TABLE "chat_messages" DROP COLUMN "deliveryStatus",
DROP COLUMN "hasErrors",
DROP COLUMN "isEncrypted",
DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "activeNow" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "memberCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "forum_posts" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_members" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "dateOfBirth" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL,
ALTER COLUMN "photos" DROP DEFAULT;

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "longDescription" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT,
    "coordinates" JSONB,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "maxParticipants" INTEGER NOT NULL DEFAULT 20,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tags" TEXT[],
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "language" TEXT,
    "skillLevel" TEXT,
    "ageRestriction" TEXT,
    "dressCode" TEXT,
    "requirements" TEXT[],
    "highlights" TEXT[],
    "aboutEvent" TEXT,
    "virtualMeetingLink" TEXT,
    "additionalInfo" TEXT,
    "agenda" TEXT[],
    "rules" TEXT[],
    "cancellationPolicy" TEXT,
    "refundPolicy" TEXT,
    "transportation" TEXT[],
    "parking" TEXT,
    "accessibility" TEXT[],
    "photos" TEXT[],
    "documents" JSONB,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "socialMedia" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'confirmed',

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reactions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'heart',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_messages" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_eventId_userId_key" ON "event_participants"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_reactions_eventId_userId_key" ON "event_reactions"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
