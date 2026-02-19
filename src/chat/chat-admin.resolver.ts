import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { ChatEntity, ChatMessageEntity } from './chat.entity';
import { ChatService } from './chat.service';
import {
  AdminChatsFilterInput,
  AdminAssignChatInput,
  AdminSetChatStatusInput,
} from './chat.input';
import { ChatMessagesFilterInput } from './chat.input';
import type { ChatDocument } from './chat.schema';
import type { MessageDocument } from './chat.schema';

function toMessageEntity(
  msg: MessageDocument,
  chatUserId: string,
): ChatMessageEntity {
  const senderId = msg.sender.toString();
  return {
    id: msg._id.toString(),
    chatId: msg.chat.toString(),
    senderId,
    isFromAdmin: senderId !== chatUserId,
    body: msg.body,
    createdAt: msg.createdAt ?? new Date(),
    readAt: msg.readAt,
  };
}

function toChatEntity(
  chat: ChatDocument,
  lastMessagePreview?: string | null,
  unreadCount?: number,
): ChatEntity {
  return {
    id: chat._id.toString(),
    userId: chat.user.toString(),
    status: chat.status,
    assignedToId: chat.assignedTo?.toString(),
    createdAt: chat.createdAt ?? new Date(),
    updatedAt: chat.updatedAt ?? new Date(),
    lastMessagePreview: lastMessagePreview ?? undefined,
    unreadCount,
  };
}

@Resolver(() => ChatEntity)
export class ChatAdminResolver {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => [ChatEntity], {
    name: 'adminChats',
    description: 'Список чатов (только для админа).',
  })
  async adminChats(
    @Args('filter', { nullable: true })
    filter: AdminChatsFilterInput | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChatEntity[]> {
    const chats = await this.chatService.adminFindChats(user.id, filter);
    const result: ChatEntity[] = [];
    for (const chat of chats) {
      const [lastMessagePreview, unreadCount] = await Promise.all([
        this.chatService.getLastMessagePreview(chat._id),
        this.chatService.countUnreadFromUser(chat._id.toString()),
      ]);
      result.push(toChatEntity(chat, lastMessagePreview, unreadCount));
    }
    return result;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => [ChatMessageEntity], {
    name: 'adminChatMessages',
    description: 'Сообщения чата (админ, любой чат).',
  })
  async adminChatMessages(
    @Args('chatId', { type: () => ID }) chatId: string,
    @Args('filter', { nullable: true })
    filter: ChatMessagesFilterInput | undefined,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<ChatMessageEntity[]> {
    await this.chatService.adminOpenChatAndMarkRead(chatId);
    const messages = await this.chatService.getMessages(chatId, {
      limit: filter?.limit,
      cursor: filter?.cursor,
    });
    const chat = await this.chatService.findChatById(chatId);
    const chatUserId = chat.user.toString();
    return messages.map((m) => toMessageEntity(m, chatUserId));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => ChatEntity, {
    name: 'adminAssignChat',
    description: 'Назначить чат на админа или снять назначение.',
  })
  async adminAssignChat(
    @Args('input') input: AdminAssignChatInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChatEntity> {
    const chat = await this.chatService.adminAssignChat(
      input.chatId,
      input.assignToUserId ?? undefined,
      user.id,
    );
    return toChatEntity(chat);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => ChatEntity, {
    name: 'adminSetChatStatus',
    description: 'Закрыть или открыть чат.',
  })
  async adminSetChatStatus(
    @Args('input') input: AdminSetChatStatusInput,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<ChatEntity> {
    const chat = await this.chatService.adminSetChatStatus(
      input.chatId,
      input.status,
    );
    return toChatEntity(chat);
  }
}
