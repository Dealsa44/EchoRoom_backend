-- CreateTable
CREATE TABLE "direct_message_visibilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "direct_message_visibilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direct_message_visibilities_userId_messageId_key" ON "direct_message_visibilities"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "direct_message_visibilities" ADD CONSTRAINT "direct_message_visibilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_visibilities" ADD CONSTRAINT "direct_message_visibilities_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "direct_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: give both sender and receiver visibility for every existing message
INSERT INTO "direct_message_visibilities" ("id", "userId", "messageId")
SELECT gen_random_uuid()::text, "userId", "messageId" FROM (
  SELECT dm."senderId" AS "userId", dm."id" AS "messageId" FROM "direct_messages" dm
  UNION ALL
  SELECT CASE WHEN dm."senderId" = c."user1Id" THEN c."user2Id" ELSE c."user1Id" END AS "userId", dm."id" AS "messageId"
  FROM "direct_messages" dm
  JOIN "conversations" c ON c."id" = dm."conversationId"
) t;
