import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const CONVERSATION_ROOM_PREFIX = 'conversation:';
const CHAT_ROOM_PREFIX = 'chat_room:';
const USER_ROOM_PREFIX = 'user:';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://driftzo.com',
    'https://www.driftzo.com',
    'http://localhost:8081',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string);
    if (!token) {
      return next(new Error('Auth required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      (socket as any).data.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).data.userId;
    if (!userId) return;

    // So we can push conversation updates (new message, reaction, theme) to this user's inbox
    socket.join(USER_ROOM_PREFIX + userId);

    socket.on('join_conversation', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId) {
        const room = CONVERSATION_ROOM_PREFIX + conversationId;
        socket.join(room);
      }
    });

    socket.on('leave_conversation', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId) {
        const room = CONVERSATION_ROOM_PREFIX + conversationId;
        socket.leave(room);
      }
    });

    socket.on('typing:start', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId) {
        socket.to(CONVERSATION_ROOM_PREFIX + conversationId).emit('typing:start', {
          userId,
          conversationId,
        });
      }
    });

    socket.on('typing:stop', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId) {
        socket.to(CONVERSATION_ROOM_PREFIX + conversationId).emit('typing:stop', {
          userId,
          conversationId,
        });
      }
    });

    // Chat rooms
    socket.on('join_chat_room', (roomId: string) => {
      if (typeof roomId === 'string' && roomId) {
        socket.join(CHAT_ROOM_PREFIX + roomId);
      }
    });

    socket.on('leave_chat_room', (roomId: string) => {
      if (typeof roomId === 'string' && roomId) {
        socket.leave(CHAT_ROOM_PREFIX + roomId);
      }
    });

    socket.on('typing:start_room', (roomId: string) => {
      if (typeof roomId === 'string' && roomId) {
        socket.to(CHAT_ROOM_PREFIX + roomId).emit('typing:start_room', {
          userId,
          roomId,
        });
      }
    });

    socket.on('typing:stop_room', (roomId: string) => {
      if (typeof roomId === 'string' && roomId) {
        socket.to(CHAT_ROOM_PREFIX + roomId).emit('typing:stop_room', {
          userId,
          roomId,
        });
      }
    });
  });

  console.log('🔌 Socket.IO attached');
  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitNewMessage(conversationId: string, message: object): void {
  if (io) {
    io.to(CONVERSATION_ROOM_PREFIX + conversationId).emit('message:new', message);
  }
}

export function emitMessageReaction(
  conversationId: string,
  payload: { messageId: string; message: object }
): void {
  if (io) {
    io.to(CONVERSATION_ROOM_PREFIX + conversationId).emit(
      'message:reaction',
      payload
    );
  }
}

export function emitThemeChanged(
  conversationId: string,
  payload: { themeId: string; themeName: string; systemMessage: { id: string; content: string; createdAt: Date } }
): void {
  if (io) {
    io.to(CONVERSATION_ROOM_PREFIX + conversationId).emit('theme:changed', payload);
  }
}

/** Notify a user that a conversation was updated (new message, reaction, theme) so inbox/list can refetch */
export function emitConversationUpdated(userId: string, conversationId: string): void {
  if (io) {
    io.to(USER_ROOM_PREFIX + userId).emit('conversation:updated', { conversationId });
  }
}

// --- Chat room socket events ---
export function emitRoomNewMessage(roomId: string, message: object): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('message:new_room', message);
  }
}

export function emitRoomMessageReaction(
  roomId: string,
  payload: { messageId: string; message: object }
): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('message:reaction_room', payload);
  }
}

export function emitRoomThemeChanged(
  roomId: string,
  payload: { themeId: string; themeName: string; systemMessage: { id: string; content: string; createdAt: Date } }
): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('theme:changed_room', payload);
  }
}

export function emitRoomUpdated(
  roomId: string,
  payload: { title?: string; description?: string; chatTheme?: string }
): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('room:updated', payload);
  }
}

export function emitRoomMemberLeft(
  roomId: string,
  payload: { userId: string; userName: string; isKick: boolean }
): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('member:left_room', payload);
  }
}

export function emitRoomMemberKicked(roomId: string, payload: { userId: string; userName: string }): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('member:kicked_room', payload);
  }
}

export function emitRoomAdminChanged(
  roomId: string,
  payload: {
    newCreatorId: string;
    newCreatorName: string;
    systemMessage: { id: string; content: string; createdAt: Date };
  }
): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('admin:changed_room', payload);
  }
}

export function emitRoomDeleted(roomId: string): void {
  if (io) {
    io.to(CHAT_ROOM_PREFIX + roomId).emit('room:deleted', { roomId });
  }
}

/** Notify a user that a chat room was updated (inbox/list refetch) */
export function emitRoomUpdatedForUser(userId: string, roomId: string): void {
  if (io) {
    io.to(USER_ROOM_PREFIX + userId).emit('room:updated', { roomId });
  }
}
