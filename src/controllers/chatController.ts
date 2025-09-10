import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all chat rooms
export const getChatRooms = async (req: Request, res: Response) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    const whereClause: any = {};
    if (category && typeof category === 'string') {
      whereClause.category = category;
    }

    const rooms = await prisma.chatRoom.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' }
    });

    // Format response
    const formattedRooms = rooms.map((room: any) => ({
      id: room.id,
      title: room.title,
      category: room.category,
      description: room.description,
      isPrivate: room.isPrivate,
      icon: room.icon,
      tags: room.tags,
      members: room._count.members,
      activeNow: room.activeNow,
      messageCount: room._count.messages,
      createdAt: room.createdAt
    }));

    return res.json({
      success: true,
      rooms: formattedRooms
    });

  } catch (error) {
    console.error('Get chat rooms error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat rooms'
    });
  }
};

// Get single chat room
export const getChatRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const room = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    return res.json({
      success: true,
      room: {
        id: room.id,
        title: room.title,
        category: room.category,
        description: room.description,
        isPrivate: room.isPrivate,
        icon: room.icon,
        tags: room.tags,
        members: room._count.members,
        activeNow: room.activeNow,
        messageCount: room._count.messages,
        membersList: room.members.map((member: any) => ({
          id: member.user.id,
          username: member.user.username,
          avatar: member.user.avatar,
          joinedAt: member.joinedAt,
          isActive: member.isActive
        })),
        createdAt: room.createdAt
      }
    });

  } catch (error) {
    console.error('Get chat room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat room'
    });
  }
};

// Join chat room
export const joinChatRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check if room exists
    const room = await prisma.chatRoom.findUnique({
      where: { id }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Check if user is already a member
    const existingMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: userId
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this room'
      });
    }

    // Add user to room
    await prisma.roomMember.create({
      data: {
        roomId: id,
        userId: userId
      }
    });

    // Update member count
    await prisma.chatRoom.update({
      where: { id },
      data: {
        memberCount: {
          increment: 1
        }
      }
    });

    return res.json({
      success: true,
      message: 'Successfully joined chat room'
    });

  } catch (error) {
    console.error('Join chat room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join chat room'
    });
  }
};

// Leave chat room
export const leaveChatRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check if user is a member
    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: userId
        }
      }
    });

    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this room'
      });
    }

    // Remove user from room
    await prisma.roomMember.delete({
      where: {
        roomId_userId: {
          roomId: id,
          userId: userId
        }
      }
    });

    // Update member count
    await prisma.chatRoom.update({
      where: { id },
      data: {
        memberCount: {
          decrement: 1
        }
      }
    });

    return res.json({
      success: true,
      message: 'Successfully left chat room'
    });

  } catch (error) {
    console.error('Leave chat room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to leave chat room'
    });
  }
};

// Get room messages
export const getRoomMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Check if user is a member of the room
    const userId = (req as any).userId;
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to view messages'
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      messages: messages.reverse() // Show oldest first
    });

  } catch (error) {
    console.error('Get room messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get messages'
    });
  }
};

// Send message to room
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', imageUrl, fileData, voiceData } = req.body;
    const userId = (req as any).userId;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Check if user is a member of the room
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to send messages'
      });
    }

    // Create message
    const message = await prisma.chatMessage.create({
      data: {
        roomId: id,
        userId: userId,
        content,
        type,
        imageUrl,
        fileData,
        voiceData
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};
