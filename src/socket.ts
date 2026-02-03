import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const CONVERSATION_ROOM_PREFIX = 'conversation:';

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
