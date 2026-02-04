import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  emitRoomNewMessage,
  emitRoomMessageReaction,
  emitRoomThemeChanged,
  emitRoomUpdated,
  emitRoomMemberLeft,
  emitRoomMemberKicked,
  emitRoomAdminChanged,
  emitRoomDeleted,
  emitRoomUpdatedForUser,
} from '../socket';

const ALLOWED_CHAT_THEMES = ['default', 'aurora', 'ocean', 'sunset', 'forest', 'midnight'] as const;
type ReactionItem = { userId: string; emoji: string };

// Helper: update room last activity and optionally create system message
async function updateRoomLastActivity(
  roomId: string,
  data: {
    lastActivityType: string;
    lastActivitySummary: string;
    lastActivityUserId: string | null;
  }
) {
  await prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      lastMessageAt: new Date(),
      lastActivityType: data.lastActivityType,
      lastActivitySummary: data.lastActivitySummary,
      lastActivityUserId: data.lastActivityUserId,
      updatedAt: new Date(),
    },
  });
}

// Create room (creator is the first member)
export const createRoom = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { title, category, description, icon, tags } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Room title is required' });
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.chatRoom.create({
        data: {
          title: title.trim(),
          category: category.trim(),
          description: typeof description === 'string' ? description.trim() : '',
          icon: typeof icon === 'string' ? icon : null,
          tags: Array.isArray(tags) ? tags.filter((t: any) => typeof t === 'string').slice(0, 10) : [],
          memberCount: 1,
          chatTheme: 'default',
        },
      });

      await tx.roomMember.create({
        data: {
          roomId: created.id,
          userId,
          isCreator: true,
        },
      });

      await tx.roomMemberState.create({
        data: {
          userId,
          roomId: created.id,
          clearedAt: new Date(),
        },
      });

      return created;
    });

    const roomWithCreator = await prisma.chatRoom.findUnique({
      where: { id: room.id },
      include: {
        _count: { select: { members: true, messages: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    });

    if (!roomWithCreator) {
      return res.status(500).json({ success: false, message: 'Room created but could not load details' });
    }

    const formatted = {
      id: roomWithCreator.id,
      title: roomWithCreator.title,
      category: roomWithCreator.category,
      description: roomWithCreator.description,
      icon: roomWithCreator.icon,
      tags: roomWithCreator.tags,
      memberCount: roomWithCreator._count.members,
      messageCount: roomWithCreator._count.messages,
      activeNow: roomWithCreator.activeNow,
      chatTheme: roomWithCreator.chatTheme,
      lastMessageAt: roomWithCreator.lastMessageAt,
      lastActivityType: roomWithCreator.lastActivityType,
      lastActivitySummary: roomWithCreator.lastActivitySummary,
      lastActivityUserId: roomWithCreator.lastActivityUserId,
      createdAt: roomWithCreator.createdAt,
      isJoined: true,
      isCreator: true,
      membersList: roomWithCreator.members.map((m: any) => ({
        id: m.user.id,
        username: m.user.username,
        avatar: m.user.avatar,
        joinedAt: m.joinedAt,
        isActive: m.isActive,
        isCreator: m.isCreator,
      })),
    };

    return res.status(201).json({ success: true, room: formatted });
  } catch (error: any) {
    console.error('Create room error:', error);
    const message = process.env.NODE_ENV !== 'production' && error?.message
      ? String(error.message)
      : 'Failed to create room';
    return res.status(500).json({ success: false, message });
  }
};

// Get joinable room count (rooms I am NOT a member of)
export const getJoinableCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const memberRoomIds = await prisma.roomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    const joinedIds = memberRoomIds.map((m) => m.roomId);
    const count = await prisma.chatRoom.count({
      where: joinedIds.length ? { id: { notIn: joinedIds } } : undefined,
    });
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Get joinable count error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get count' });
  }
};

// Get all chat rooms with isJoined for current user; support search and category
export const getChatRooms = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { category, search, limit = 50, offset = 0 } = req.query;

    const whereClause: any = {};
    if (category && typeof category === 'string' && category !== 'all') {
      whereClause.category = category;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().toLowerCase();
      whereClause.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [rooms, myMemberships] = await Promise.all([
      prisma.chatRoom.findMany({
        where: whereClause,
        include: {
          _count: { select: { members: true, messages: true } },
        },
        take: Math.min(100, parseInt(limit as string) || 50),
        skip: parseInt(offset as string) || 0,
        orderBy: { lastMessageAt: 'desc' },
      }),
      userId
        ? prisma.roomMember.findMany({
            where: { userId },
            select: { roomId: true, isCreator: true },
          })
        : Promise.resolve([]),
    ]);

    const joinedSet = new Map(myMemberships.map((m) => [m.roomId, m.isCreator]));

    const formattedRooms = rooms.map((room: any) => ({
      id: room.id,
      title: room.title,
      category: room.category,
      description: room.description,
      icon: room.icon,
      tags: room.tags,
      members: room._count.members,
      memberCount: room._count.members,
      activeNow: room.activeNow,
      messageCount: room._count.messages,
      chatTheme: room.chatTheme,
      lastMessageAt: room.lastMessageAt,
      lastActivityType: room.lastActivityType,
      lastActivitySummary: room.lastActivitySummary,
      lastActivityUserId: room.lastActivityUserId,
      createdAt: room.createdAt,
      isJoined: joinedSet.has(room.id),
      isCreator: joinedSet.get(room.id) ?? false,
    }));

    return res.json({ success: true, rooms: formattedRooms });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get chat rooms' });
  }
};

// Get single room with my membership and state
export const getChatRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const room = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
        _count: { select: { members: true, messages: true } },
      },
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const myMember = room.members.find((m: any) => m.userId === userId);
    const myState = userId
      ? await prisma.roomMemberState.findUnique({
          where: {
            userId_roomId: { userId, roomId: id },
          },
        })
      : null;

    return res.json({
      success: true,
      room: {
        id: room.id,
        title: room.title,
        category: room.category,
        description: room.description,
        icon: room.icon,
        tags: room.tags,
        chatTheme: room.chatTheme,
        lastMessageAt: room.lastMessageAt,
        lastActivityType: room.lastActivityType,
        lastActivitySummary: room.lastActivitySummary,
        lastActivityUserId: room.lastActivityUserId,
        memberCount: room._count.members,
        activeNow: room.activeNow,
        messageCount: room._count.messages,
        createdAt: room.createdAt,
        isJoined: !!myMember,
        isCreator: myMember?.isCreator ?? false,
        isArchived: myState?.isArchived ?? false,
        clearedAt: myState?.clearedAt ?? null,
        membersList: room.members.map((m: any) => ({
          id: m.user.id,
          username: m.user.username,
          avatar: m.user.avatar,
          joinedAt: m.joinedAt,
          isActive: m.isActive,
          isCreator: m.isCreator,
        })),
      },
    });
  } catch (error) {
    console.error('Get chat room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get chat room' });
  }
};

// Join room: create member (isCreator if first), state with clearedAt = now
export const joinChatRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const room = await prisma.chatRoom.findUnique({ where: { id } });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const existing = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already a member' });
    }

    const memberCount = await prisma.roomMember.count({ where: { roomId: id } });
    const isCreator = memberCount === 0;

    await prisma.$transaction([
      prisma.roomMember.create({
        data: { roomId: id, userId, isCreator },
      }),
      prisma.roomMemberState.upsert({
        where: { userId_roomId: { userId, roomId: id } },
        create: { userId, roomId: id, clearedAt: new Date() },
        update: { clearedAt: new Date(), isArchived: false },
      }),
      prisma.chatRoom.update({
        where: { id },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    const joiningUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const summary = `${joiningUser?.username || 'A member'} joined the room`;
    await updateRoomLastActivity(id, {
      lastActivityType: 'message',
      lastActivitySummary: summary,
      lastActivityUserId: userId,
    });

    const systemMsg = await prisma.chatMessage.create({
      data: {
        roomId: id,
        userId,
        content: summary,
        type: 'system',
      },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });

    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });
    await prisma.roomMessageVisibility.createMany({
      data: members.map((m) => ({ userId: m.userId, messageId: systemMsg.id })),
    });

    emitRoomNewMessage(id, {
      id: systemMsg.id,
      userId: systemMsg.userId,
      content: systemMsg.content,
      type: 'system',
      createdAt: systemMsg.createdAt,
      user: (systemMsg as any).user,
    });
    members.forEach((m) => emitRoomUpdatedForUser(m.userId, id));

    return res.json({ success: true, message: 'Joined room' });
  } catch (error) {
    console.error('Join chat room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to join room' });
  }
};

// Leave room: delete member, state, my visibilities; if creator, transfer to random member
async function removeMemberFromRoom(roomId: string, userId: string, actorUserId: string, isKick: boolean) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return;

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!member) return;

  const messageIds = await prisma.chatMessage.findMany({
    where: { roomId },
    select: { id: true },
  });

  await prisma.$transaction([
    ...messageIds.map((m) =>
      prisma.roomMessageVisibility.deleteMany({
        where: { userId, messageId: m.id },
      })
    ),
    prisma.roomMemberState.deleteMany({ where: { userId, roomId } }),
    prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    }),
    prisma.chatRoom.update({
      where: { id: roomId },
      data: { memberCount: { decrement: 1 } },
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  const userName = user?.username || 'A member';
  const summary = isKick ? `${userName} was removed from the room` : `${userName} left the room`;
  await updateRoomLastActivity(roomId, {
    lastActivityType: isKick ? 'member_kicked' : 'member_left',
    lastActivitySummary: summary,
    lastActivityUserId: actorUserId,
  });

  const systemMsg = await prisma.chatMessage.create({
    data: {
      roomId,
      userId: actorUserId,
      content: summary,
      type: 'system',
    },
  });

  const remaining = await prisma.roomMember.findMany({
    where: { roomId },
    select: { userId: true },
  });
  await prisma.roomMessageVisibility.createMany({
    data: remaining.map((m) => ({ userId: m.userId, messageId: systemMsg.id })),
  });

  if (member.isCreator && remaining.length > 0) {
    const newCreator = remaining[Math.floor(Math.random() * remaining.length)];
    await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: newCreator.userId } },
      data: { isCreator: true },
    });
    const newCreatorUser = await prisma.user.findUnique({
      where: { id: newCreator.userId },
      select: { username: true },
    });
    const adminSummary = `${newCreatorUser?.username || 'A member'} is now the admin`;
    await updateRoomLastActivity(roomId, {
      lastActivityType: 'admin_changed',
      lastActivitySummary: adminSummary,
      lastActivityUserId: newCreator.userId,
    });
    const adminMsg = await prisma.chatMessage.create({
      data: {
        roomId,
        userId: newCreator.userId,
        content: adminSummary,
        type: 'system',
      },
    });
    await prisma.roomMessageVisibility.createMany({
      data: remaining.map((m) => ({ userId: m.userId, messageId: adminMsg.id })),
    });
    emitRoomAdminChanged(roomId, {
      newCreatorId: newCreator.userId,
      newCreatorName: newCreatorUser?.username || 'A member',
      systemMessage: { id: adminMsg.id, content: adminMsg.content, createdAt: adminMsg.createdAt },
    });
  }

  emitRoomMemberLeft(roomId, { userId, userName, isKick });
  remaining.forEach((m) => emitRoomUpdatedForUser(m.userId, roomId));
  emitRoomUpdatedForUser(userId, roomId);
}

export const leaveChatRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!member) {
      return res.status(400).json({ success: false, message: 'Not a member' });
    }

    await removeMemberFromRoom(id, userId, userId, false);

    return res.json({ success: true, message: 'Left room' });
  } catch (error) {
    console.error('Leave chat room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to leave room' });
  }
};

// Kick member (creator only)
export const kickMember = async (req: Request, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const actorId = (req as any).userId;

    const creator = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: actorId } },
    });
    if (!creator?.isCreator) {
      return res.status(403).json({ success: false, message: 'Only the room creator can kick members' });
    }
    if (targetUserId === actorId) {
      return res.status(400).json({ success: false, message: 'Cannot kick yourself' });
    }

    const target = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: targetUserId } },
    });
    if (!target) {
      return res.status(404).json({ success: false, message: 'User is not a member' });
    }

    await removeMemberFromRoom(id, targetUserId, actorId, true);

    return res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    console.error('Kick member error:', error);
    return res.status(500).json({ success: false, message: 'Failed to kick member' });
  }
};

// Delete room (creator only)
export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const room = await prisma.chatRoom.findUnique({ where: { id } });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!member?.isCreator) {
      return res.status(403).json({ success: false, message: 'Only the creator can delete the room' });
    }

    const memberIds = await prisma.roomMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });

    await prisma.chatRoom.delete({ where: { id } });

    emitRoomDeleted(id);
    memberIds.forEach((m) => emitRoomUpdatedForUser(m.userId, id));

    return res.json({ success: true, message: 'Room deleted' });
  } catch (error) {
    console.error('Delete room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete room' });
  }
};

// Get room messages (only after clearedAt and visible to me)
export const getRoomMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = (req as any).userId;

    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Must be a member to view messages' });
    }

    const state = await prisma.roomMemberState.findUnique({
      where: { userId_roomId: { userId, roomId: id } },
    });
    const clearedAt = state?.clearedAt ?? new Date(0);

    const messagesAfterClear = await prisma.chatMessage.findMany({
      where: { roomId: id, createdAt: { gt: clearedAt } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const allIds = messagesAfterClear.map((m) => m.id);
    if (allIds.length === 0) {
      return res.json({ success: true, messages: [], total: 0 });
    }

    const visibleRows = await prisma.roomMessageVisibility.findMany({
      where: { userId, messageId: { in: allIds } },
      select: { messageId: true },
    });
    const visibleSet = new Set(visibleRows.map((v) => v.messageId));
    const ids = allIds.filter((id) => visibleSet.has(id));

    const take = Math.min(100, parseInt(limit as string) || 50);
    const skip = Math.min(parseInt(offset as string) || 0, Math.max(0, ids.length - 1));
    const messages = await prisma.chatMessage.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });

    const total = ids.length;

    const list = messages.map((m: any) => ({
      id: m.id,
      roomId: m.roomId,
      userId: m.userId,
      content: m.content,
      type: m.type,
      imageUrl: m.imageUrl,
      fileData: m.fileData,
      voiceData: m.voiceData,
      reactions: (m.reactions as ReactionItem[] | null) || [],
      createdAt: m.createdAt,
      user: m.user,
    }));

    return res.json({ success: true, messages: list, total });
  } catch (error) {
    console.error('Get room messages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
};

// Send message: create message, visibility for all members, update room, unarchive all
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', imageUrl, fileData, voiceData } = req.body;
    const userId = (req as any).userId;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Must be a member to send messages' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId: id,
        userId,
        content: content.trim(),
        type,
        imageUrl,
        fileData,
        voiceData,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });
    await prisma.roomMessageVisibility.createMany({
      data: members.map((m) => ({ userId: m.userId, messageId: message.id })),
    });

    const summary = content.trim().slice(0, 80);
    await prisma.chatRoom.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastActivityType: 'message',
        lastActivitySummary: summary,
        lastActivityUserId: userId,
        updatedAt: new Date(),
      },
    });

    await prisma.roomMemberState.updateMany({
      where: { roomId: id },
      data: { isArchived: false },
    });

    const payload = {
      id: message.id,
      roomId: message.roomId,
      userId: message.userId,
      content: message.content,
      type: message.type,
      imageUrl: message.imageUrl,
      fileData: message.fileData,
      voiceData: message.voiceData,
      reactions: (message.reactions as ReactionItem[] | null) || [],
      createdAt: message.createdAt,
      user: message.user,
    };
    emitRoomNewMessage(id, payload);
    members.forEach((m) => emitRoomUpdatedForUser(m.userId, id));

    return res.status(201).json({ success: true, message: payload });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// Update room (title, description, theme) - creator only for title/description; any member for theme
export const updateRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { title, description, chatTheme } = req.body;

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (member.isCreator) {
      if (typeof title === 'string' && title.trim()) updateData.title = title.trim();
      if (typeof description === 'string') updateData.description = description.trim();
    }
    if (chatTheme && typeof chatTheme === 'string' && ALLOWED_CHAT_THEMES.includes(chatTheme as any)) {
      updateData.chatTheme = chatTheme;
    }

    if (Object.keys(updateData).length <= 1) {
      return res.json({ success: true, room: await prisma.chatRoom.findUnique({ where: { id } }) });
    }

    const room = await prisma.chatRoom.update({
      where: { id },
      data: updateData,
    });

    if (updateData.chatTheme) {
      const themeName = updateData.chatTheme;
      const content = `Theme changed to ${themeName}`;
      await prisma.chatRoom.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          lastActivityType: 'theme',
          lastActivitySummary: content,
          lastActivityUserId: userId,
          updatedAt: new Date(),
        },
      });
      const systemMsg = await prisma.chatMessage.create({
        data: { roomId: id, userId, content, type: 'system' },
      });
      const members = await prisma.roomMember.findMany({
        where: { roomId: id },
        select: { userId: true },
      });
      await prisma.roomMessageVisibility.createMany({
        data: members.map((m) => ({ userId: m.userId, messageId: systemMsg.id })),
      });
      emitRoomThemeChanged(id, {
        themeId: updateData.chatTheme,
        themeName,
        systemMessage: { id: systemMsg.id, content: systemMsg.content, createdAt: systemMsg.createdAt },
      });
      await prisma.roomMemberState.updateMany({
        where: { roomId: id },
        data: { isArchived: false },
      });
    }

    emitRoomUpdated(id, { title: room.title, description: room.description, chatTheme: room.chatTheme ?? undefined });
    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });
    members.forEach((m) => emitRoomUpdatedForUser(m.userId, id));

    return res.json({ success: true, room });
  } catch (error) {
    console.error('Update room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update room' });
  }
};

// Set room theme only (same as DM)
export const setRoomTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const themeId = typeof req.body?.themeId === 'string' ? req.body.themeId.trim().toLowerCase() : '';
    const themeName = typeof req.body?.themeName === 'string' ? req.body.themeName.trim() : themeId;

    if (!themeId || !ALLOWED_CHAT_THEMES.includes(themeId as any)) {
      return res.status(400).json({ success: false, message: 'Invalid theme' });
    }

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    const content = `Theme changed to ${themeName}`;
    await prisma.chatRoom.update({
      where: { id },
      data: {
        chatTheme: themeId,
        lastMessageAt: new Date(),
        lastActivityType: 'theme',
        lastActivitySummary: content,
        lastActivityUserId: userId,
        updatedAt: new Date(),
      },
    });

    const systemMsg = await prisma.chatMessage.create({
      data: { roomId: id, userId, content, type: 'system' },
    });
    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });
    await prisma.roomMessageVisibility.createMany({
      data: members.map((m) => ({ userId: m.userId, messageId: systemMsg.id })),
    });

    await prisma.roomMemberState.updateMany({
      where: { roomId: id },
      data: { isArchived: false },
    });

    emitRoomThemeChanged(id, {
      themeId,
      themeName,
      systemMessage: { id: systemMsg.id, content: systemMsg.content, createdAt: systemMsg.createdAt },
    });
    members.forEach((m) => emitRoomUpdatedForUser(m.userId, id));

    return res.json({
      success: true,
      themeId,
      themeName,
      systemMessage: {
        id: systemMsg.id,
        content: systemMsg.content,
        type: 'system',
        createdAt: systemMsg.createdAt,
      },
    });
  } catch (error) {
    console.error('Set room theme error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set theme' });
  }
};

// Archive / unarchive
export const setRoomArchived = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const isArchived = req.body.isArchived === true;

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    await prisma.roomMemberState.upsert({
      where: { userId_roomId: { userId, roomId: id } },
      create: { userId, roomId: id, isArchived },
      update: { isArchived },
    });

    emitRoomUpdatedForUser(userId, id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Set room archived error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update archive state' });
  }
};

// Clear chat for me (set clearedAt = now)
export const clearRoomChat = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    await prisma.roomMemberState.upsert({
      where: { userId_roomId: { userId, roomId: id } },
      create: { userId, roomId: id, clearedAt: new Date() },
      update: { clearedAt: new Date() },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Clear room chat error:', error);
    return res.status(500).json({ success: false, message: 'Failed to clear chat' });
  }
};

// Delete message for me (remove visibility row)
export const deleteMessageForMe = async (req: Request, res: Response) => {
  try {
    const { id, messageId } = req.params;
    const userId = (req as any).userId;

    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, roomId: id },
    });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await prisma.roomMessageVisibility.deleteMany({
      where: { userId, messageId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete message for me error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

// Add reaction to room message
export const addMessageReaction = async (req: Request, res: Response) => {
  try {
    const { id, messageId } = req.params;
    const { emoji } = req.body;
    const userId = (req as any).userId;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ success: false, message: 'Emoji required' });
    }

    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, roomId: id },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const reactions = ((message.reactions as ReactionItem[] | null) || []).filter((r) => !(r.userId === userId));
    reactions.push({ userId, emoji: emoji.trim() });
    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });

    const summary = `Reacted with ${emoji.trim()}`;
    await prisma.chatRoom.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastActivityType: 'reaction',
        lastActivitySummary: summary,
        lastActivityUserId: userId,
        updatedAt: new Date(),
      },
    });

    await prisma.roomMemberState.updateMany({
      where: { roomId: id },
      data: { isArchived: false },
    });

    const payload = {
      id: updated.id,
      roomId: updated.roomId,
      userId: updated.userId,
      content: updated.content,
      type: updated.type,
      reactions: (updated.reactions as ReactionItem[]) || [],
      createdAt: updated.createdAt,
      user: updated.user,
    };
    emitRoomMessageReaction(id, { messageId: updated.id, message: payload });
    const members = await prisma.roomMember.findMany({
      where: { roomId: id },
      select: { userId: true },
    });
    members.forEach((m) => emitRoomUpdatedForUser(m.userId, id));

    return res.json({ success: true, message: payload });
  } catch (error) {
    console.error('Add message reaction error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add reaction' });
  }
};

// List my joined rooms (for inbox)
export const listMyRooms = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const memberships = await prisma.roomMember.findMany({
      where: { userId },
      include: { room: true },
    });

    const list = await Promise.all(
      memberships.map(async (m) => {
        const state = await prisma.roomMemberState.findUnique({
          where: { userId_roomId: { userId, roomId: m.roomId } },
        });
        return {
          id: m.room.id,
          title: m.room.title,
          category: m.room.category,
          description: m.room.description,
          icon: m.room.icon,
          memberCount: m.room.memberCount,
          chatTheme: m.room.chatTheme,
          lastMessageAt: m.room.lastMessageAt,
          lastActivityType: m.room.lastActivityType,
          lastActivitySummary: m.room.lastActivitySummary,
          lastActivityUserId: m.room.lastActivityUserId,
          isCreator: m.isCreator,
          isArchived: state?.isArchived ?? false,
        };
      })
    );

    const sorted = list.sort((a, b) => {
      const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tB - tA;
    });

    return res.json({ success: true, rooms: sorted });
  } catch (error) {
    console.error('List my rooms error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list rooms' });
  }
};
