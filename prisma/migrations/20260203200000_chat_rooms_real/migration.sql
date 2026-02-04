-- AlterTable ChatRoom: add theme and last activity
ALTER TABLE "chat_rooms" ADD COLUMN "chatTheme" TEXT DEFAULT 'default';
ALTER TABLE "chat_rooms" ADD COLUMN "lastMessageAt" TIMESTAMP(3);
ALTER TABLE "chat_rooms" ADD COLUMN "lastActivityType" TEXT;
ALTER TABLE "chat_rooms" ADD COLUMN "lastActivitySummary" TEXT;
ALTER TABLE "chat_rooms" ADD COLUMN "lastActivityUserId" TEXT;

-- AlterTable RoomMember: add isCreator
ALTER TABLE "room_members" ADD COLUMN "isCreator" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable RoomMemberState
CREATE TABLE "room_member_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "room_member_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_member_states_userId_roomId_key" ON "room_member_states"("userId", "roomId");

ALTER TABLE "room_member_states" ADD CONSTRAINT "room_member_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_member_states" ADD CONSTRAINT "room_member_states_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable RoomMessageVisibility
CREATE TABLE "room_message_visibilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "room_message_visibilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_message_visibilities_userId_messageId_key" ON "room_message_visibilities"("userId", "messageId");

ALTER TABLE "room_message_visibilities" ADD CONSTRAINT "room_message_visibilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_message_visibilities" ADD CONSTRAINT "room_message_visibilities_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
