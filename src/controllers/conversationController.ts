import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emitNewMessage, emitMessageReaction, emitThemeChanged, emitConversationUpdated } from '../socket';

const prisma = new PrismaClient();

const ALLOWED_CHAT_THEMES = ['default', 'aurora', 'ocean', 'sunset', 'forest', 'midnight'] as const;

type ReactionItem = { userId: string; emoji: string };

// Normalize conversation pair so user1Id <= user2Id
function normalizePair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

// List my conversations (exclude deleted). Optionally filter by archived.
export const listConversations = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    if (!me) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const archived = req.query.archived === 'true';

    const states = await prisma.conversationState.findMany({
      where: {
        userId: me,
        deletedAt: null,
        isArchived: archived,
      },
      include: {
        conversation: {
          include: {
            user1: { select: { id: true, username: true, avatar: true } },
            user2: { select: { id: true, username: true, avatar: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, username: true } } },
            },
          },
        },
      },
    });

    const list = states
      .map((s) => {
      const c = s.conversation;
      const other = c.user1Id === me ? c.user2 : c.user1;
      const lastMsg = c.messages[0];
      return {
        id: c.id,
        otherUser: {
          id: other.id,
          name: other.username,
          avatar: other.avatar || '🌟',
        },
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content,
              senderId: lastMsg.senderId,
              senderName: lastMsg.sender.username,
              createdAt: lastMsg.createdAt,
              type: lastMsg.type,
            }
          : null,
        lastMessageAt: c.lastMessageAt,
        lastActivityType: c.lastActivityType ?? null,
        lastActivitySummary: c.lastActivitySummary ?? null,
        lastActivityUserId: c.lastActivityUserId ?? null,
        isArchived: s.isArchived,
      };
    })
    .sort((a, b) => {
      const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tB - tA;
    });

    return res.json({ success: true, conversations: list });
  } catch (error) {
    console.error('List conversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list conversations' });
  }
};

// Get or create conversation with another user
export const getOrCreateConversation = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const otherUserId = req.params.userId;
    if (!me || !otherUserId) {
      return res.status(400).json({ success: false, message: 'Missing user id' });
    }
    if (me === otherUserId) {
      return res.status(400).json({ success: false, message: 'Cannot chat with yourself' });
    }

    const [u1, u2] = normalizePair(me, otherUserId);

    let conversation = await prisma.conversation.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      include: {
        user1: { select: { id: true, username: true, avatar: true } },
        user2: { select: { id: true, username: true, avatar: true } },
      },
    });

    if (conversation) {
      await prisma.conversationState.upsert({
        where: {
          userId_conversationId: { userId: me, conversationId: conversation.id },
        },
        create: { userId: me, conversationId: conversation.id },
        update: { deletedAt: null },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { user1Id: u1, user2Id: u2 },
        include: {
          user1: { select: { id: true, username: true, avatar: true } },
          user2: { select: { id: true, username: true, avatar: true } },
        },
      });
      // Ensure both users have a state row so list works
      await prisma.conversationState.upsert({
        where: {
          userId_conversationId: { userId: me, conversationId: conversation.id },
        },
        create: { userId: me, conversationId: conversation.id },
        update: {},
      });
      const otherId = u1 === me ? u2 : u1;
      await prisma.conversationState.upsert({
        where: {
          userId_conversationId: { userId: otherId, conversationId: conversation.id },
        },
        create: { userId: otherId, conversationId: conversation.id },
        update: {},
      });
    }

    const other = conversation.user1Id === me ? conversation.user2 : conversation.user1;
    return res.json({
      success: true,
      conversation: {
        id: conversation.id,
        chatTheme: conversation.chatTheme || 'default',
        otherUser: {
          id: other.id,
          name: other.username,
          avatar: other.avatar || '🌟',
        },
      },
    });
  } catch (error) {
    console.error('Get or create conversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get or create conversation' });
  }
};

// Get messages for a conversation (paginated, newest last for chat order)
export const getMessages = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const conversationId = req.params.conversationId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    if (!me || !conversationId) {
      return res.status(400).json({ success: false, message: 'Missing conversation' });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const visibleMessageIds = await prisma.directMessageVisibility.findMany({
      where: { userId: me, message: { conversationId } },
      select: { messageId: true },
    });
    const ids = visibleMessageIds.map((v) => v.messageId);
    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId,
        id: { in: ids.length ? ids : ['__none__'] },
      },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

    const chatTheme = conv.chatTheme || 'default';

    const items = messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.username,
      senderAvatar: m.sender.avatar,
      content: m.content,
      type: m.type,
      reactions: (m.reactions as ReactionItem[] | null) || [],
      createdAt: m.createdAt,
    }));

    return res.json({ success: true, messages: items, chatTheme });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
};

// Send a text message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const conversationId = req.params.conversationId;
    const { content } = req.body;
    if (!me || !conversationId || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Missing conversation or content' });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: me,
        content: content.trim(),
        type: 'text',
      },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
    });

    const otherId = conv.user1Id === me ? conv.user2Id : conv.user1Id;
    await prisma.directMessageVisibility.createMany({
      data: [
        { userId: me, messageId: message.id },
        { userId: otherId, messageId: message.id },
      ],
    });

    // If the other person had deleted or archived the chat, bring it back in their main messages list
    await prisma.conversationState.upsert({
      where: {
        userId_conversationId: { userId: otherId, conversationId },
      },
      create: { userId: otherId, conversationId },
      update: { deletedAt: null, clearedAt: null, isArchived: false },
    });

    const summary = content.trim().slice(0, 80);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastActivityType: 'message',
        lastActivitySummary: summary,
        lastActivityUserId: me,
        updatedAt: new Date(),
      },
    });

    const messagePayload = {
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.username,
      senderAvatar: message.sender.avatar,
      content: message.content,
      type: message.type,
      reactions: (message.reactions as ReactionItem[] | null) || [],
      createdAt: message.createdAt,
    };
    emitNewMessage(conversationId, messagePayload);
    emitConversationUpdated(otherId, conversationId);
    emitConversationUpdated(me, conversationId);

    return res.json({
      success: true,
      message: messagePayload,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// Set chat theme for conversation (both participants see it)
export const setConversationTheme = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const conversationId = req.params.conversationId;
    const themeId = typeof req.body?.themeId === 'string' ? req.body.themeId.trim().toLowerCase() : '';
    const themeName = typeof req.body?.themeName === 'string' ? req.body.themeName.trim() : themeId;

    if (!me || !conversationId) {
      return res.status(400).json({ success: false, message: 'Missing conversation' });
    }
    if (!themeId || !ALLOWED_CHAT_THEMES.includes(themeId as any)) {
      return res.status(400).json({ success: false, message: 'Invalid theme' });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const content = `Theme changed to ${themeName}`;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        chatTheme: themeId,
        lastMessageAt: new Date(),
        lastActivityType: 'theme',
        lastActivitySummary: content,
        lastActivityUserId: me,
        updatedAt: new Date(),
      },
    });
    const systemMessage = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: me,
        content,
        type: 'system',
      },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
    });

    const otherId = conv.user1Id === me ? conv.user2Id : conv.user1Id;
    await prisma.directMessageVisibility.createMany({
      data: [
        { userId: me, messageId: systemMessage.id },
        { userId: otherId, messageId: systemMessage.id },
      ],
    });

    // If the other person had archived the chat, bring it back to their inbox
    await prisma.conversationState.upsert({
      where: {
        userId_conversationId: { userId: otherId, conversationId },
      },
      create: { userId: otherId, conversationId },
      update: { deletedAt: null, clearedAt: null, isArchived: false },
    });

    const systemMessagePayload = {
      id: systemMessage.id,
      senderId: systemMessage.senderId,
      senderName: systemMessage.sender.username,
      senderAvatar: systemMessage.sender.avatar,
      content: systemMessage.content,
      type: systemMessage.type,
      reactions: [],
      createdAt: systemMessage.createdAt,
    };
    emitThemeChanged(conversationId, {
      themeId,
      themeName,
      systemMessage: {
        id: systemMessage.id,
        content: systemMessage.content,
        createdAt: systemMessage.createdAt,
      },
    });
    emitNewMessage(conversationId, systemMessagePayload);
    emitConversationUpdated(otherId, conversationId);
    emitConversationUpdated(me, conversationId);

    return res.json({
      success: true,
      themeId,
      themeName,
      systemMessage: systemMessagePayload,
    });
  } catch (error) {
    console.error('Set conversation theme error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set theme' });
  }
};

// Archive or unarchive
export const setArchived = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const conversationId = req.params.conversationId;
    const isArchived = req.body.isArchived === true;
    if (!me || !conversationId) {
      return res.status(400).json({ success: false, message: 'Missing conversation' });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    await prisma.conversationState.upsert({
      where: {
        userId_conversationId: { userId: me, conversationId },
      },
      create: { userId: me, conversationId, isArchived },
      update: { isArchived },
    });

    emitConversationUpdated(me, conversationId);

    return res.json({ success: true });
  } catch (error) {
    console.error('Set archived error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update archive state' });
  }
};

// Delete for current user only: hard-delete my visibility rows (messages disappear for me) and hide from my list.
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const conversationId = req.params.conversationId;
    if (!me || !conversationId) {
      return res.status(400).json({ success: false, message: 'Missing conversation' });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== me && conv.user2Id !== me)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messageIds = await prisma.directMessage.findMany({
      where: { conversationId },
      select: { id: true },
    });
    const ids = messageIds.map((m) => m.id);
    if (ids.length > 0) {
      await prisma.directMessageVisibility.deleteMany({
        where: { userId: me, messageId: { in: ids } },
      });
    }

    const now = new Date();
    await prisma.conversationState.upsert({
      where: {
        userId_conversationId: { userId: me, conversationId },
      },
      create: { userId: me, conversationId, deletedAt: now, clearedAt: now },
      update: { deletedAt: now, clearedAt: now },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete conversation' });
  }
};

// React to a message (toggle emoji for current user)
export const reactToMessage = async (req: Request, res: Response) => {
  try {
    const me = (req as any).userId;
    const messageId = req.params.messageId;
    const { emoji } = req.body;
    if (!me || !messageId || typeof emoji !== 'string' || !emoji.trim()) {
      return res.status(400).json({ success: false, message: 'Missing message or emoji' });
    }

    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    const { conversationId } = message;
    const conv = message.conversation;
    if (conv.user1Id !== me && conv.user2Id !== me) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const reactions: ReactionItem[] = ((message.reactions as ReactionItem[] | null) || []).filter(
      (r) => r.userId !== me
    );
    const existing = (message.reactions as ReactionItem[] | null)?.find((r) => r.userId === me);
    if (existing && existing.emoji === emoji.trim()) {
      // Remove reaction
    } else {
      reactions.push({ userId: me, emoji: emoji.trim() });
    }

    const updated = await prisma.directMessage.update({
      where: { id: messageId },
      data: { reactions: reactions as any },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
    });

    const otherId = conv.user1Id === me ? conv.user2Id : conv.user1Id;

    const emojiStr = emoji.trim();
    const reactionSummary = `Reacted with ${emojiStr}`;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastActivityType: 'reaction',
        lastActivitySummary: reactionSummary,
        lastActivityUserId: me,
        updatedAt: new Date(),
      },
    });

    // If the other person had archived the chat, bring it back to their inbox
    await prisma.conversationState.upsert({
      where: {
        userId_conversationId: { userId: otherId, conversationId },
      },
      create: { userId: otherId, conversationId },
      update: { deletedAt: null, clearedAt: null, isArchived: false },
    });

    const messagePayload = {
      id: updated.id,
      senderId: updated.senderId,
      senderName: updated.sender.username,
      senderAvatar: updated.sender.avatar,
      content: updated.content,
      type: updated.type,
      reactions: (updated.reactions as ReactionItem[]) || [],
      createdAt: updated.createdAt,
    };
    emitMessageReaction(conversationId, { messageId: updated.id, message: messagePayload });
    emitConversationUpdated(otherId, conversationId);
    emitConversationUpdated(me, conversationId);

    return res.json({
      success: true,
      message: messagePayload,
    });
  } catch (error) {
    console.error('React to message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to react' });
  }
};
