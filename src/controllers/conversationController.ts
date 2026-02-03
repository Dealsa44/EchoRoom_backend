import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const myState = await prisma.conversationState.findUnique({
      where: { userId_conversationId: { userId: me, conversationId } },
    });
    const clearedAt = myState?.clearedAt ?? null;

    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId,
        ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
      },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

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

    return res.json({ success: true, messages: items });
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

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), updatedAt: new Date() },
    });

    return res.json({
      success: true,
      message: {
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender.username,
        senderAvatar: message.sender.avatar,
        content: message.content,
        type: message.type,
        reactions: (message.reactions as ReactionItem[] | null) || [],
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
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

    return res.json({ success: true });
  } catch (error) {
    console.error('Set archived error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update archive state' });
  }
};

// Soft delete for current user (hide from list)
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

    return res.json({
      success: true,
      message: {
        id: updated.id,
        senderId: updated.senderId,
        senderName: updated.sender.username,
        senderAvatar: updated.sender.avatar,
        content: updated.content,
        type: updated.type,
        reactions: (updated.reactions as ReactionItem[]) || [],
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error('React to message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to react' });
  }
};
