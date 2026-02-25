import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/schemas/user.schema';

const ROOM_USER_PREFIX = 'user:';
const ROOM_ADMIN = 'admin:chats';
const ROOM_CHAT_PREFIX = 'chat:';

type AuthenticatedSocket = Socket & { userId?: string; isAdmin?: boolean };

export interface ChatMessagePayload {
  chatId: string;
  message: {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    isFromAdmin: boolean;
  };
}

function parseTokenFromHandshake(socket: Socket): string | null {
  const auth = (socket.handshake.auth as { token?: string })?.token;
  if (typeof auth === 'string' && auth.trim()) return auth.trim();
  const cookieHeader = socket.handshake.headers?.cookie;
  if (typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(/\btoken=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

@WebSocketGateway({
  path: '/chat-socket',
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = parseTokenFromHandshake(client);
    if (!token) {
      this.logger.warn('Chat socket: no token');
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: UserRole;
        type?: string;
      }>(token);
      if (payload.type && payload.type !== 'access') {
        client.disconnect();
        return;
      }
      const user = await this.userService.findById(payload.sub);
      if (user.isBlocked) {
        client.disconnect();
        return;
      }
      client.userId = payload.sub;
      client.isAdmin = user.role === UserRole.ADMIN;

      void client.join(ROOM_USER_PREFIX + payload.sub);
      if (client.isAdmin) {
        void client.join(ROOM_ADMIN);
      }
    } catch {
      this.logger.warn('Chat socket: invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(_client: AuthenticatedSocket): void {
    // rooms are left automatically
  }

  @SubscribeMessage('joinChat')
  handleJoinChat(
    client: AuthenticatedSocket,
    payload: { chatId: string },
  ): void {
    if (!client.userId || !payload?.chatId) return;
    client.join(ROOM_CHAT_PREFIX + payload.chatId);
  }

  /** Вызывается из ChatService после сохранения сообщения. */
  emitNewMessage(
    chatUserId: string,
    assignedToId: string | undefined,
    chatId: string,
    messagePayload: ChatMessagePayload['message'],
  ): void {
    const payload: ChatMessagePayload = { chatId, message: messagePayload };
    void this.server.to(ROOM_CHAT_PREFIX + chatId).emit('message:new', payload);
    void this.server
      .to(ROOM_USER_PREFIX + chatUserId)
      .emit('message:new', payload);
    if (assignedToId) {
      void this.server
        .to(ROOM_USER_PREFIX + assignedToId)
        .emit('message:new', payload);
    } else {
      void this.server.to(ROOM_ADMIN).emit('message:new', payload);
    }
  }
}
