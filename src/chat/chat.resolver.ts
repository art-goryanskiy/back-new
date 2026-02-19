import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { ChatEntity, ChatMessageEntity } from './chat.entity';
import { ChatService } from './chat.service';
import { SendMessageInput, ChatMessagesFilterInput } from './chat.input';
import type { ChatDocument } from './chat.schema';
import type { MessageDocument } from './chat.schema';
import { UserRole } from 'src/user/schemas/user.schema';

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

function toChatEntity(chat: ChatDocument): ChatEntity {
  return {
    id: chat._id.toString(),
    userId: chat.user.toString(),
    status: chat.status,
    assignedToId: chat.assignedTo?.toString(),
    createdAt: chat.createdAt ?? new Date(),
    updatedAt: chat.updatedAt ?? new Date(),
  };
}

@Resolver(() => ChatEntity)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => ChatEntity, {
    nullable: true,
    description:
      'Мой чат (один на пользователя). Создаётся при первом сообщении.',
  })
  async myChat(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChatEntity | null> {
    const chat = await this.chatService.findOrCreateChatByUser(user.id);
    return toChatEntity(chat);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [ChatMessageEntity], {
    description: 'Сообщения чата. Доступ: владелец чата или админ.',
  })
  async chatMessages(
    @Args('chatId', { type: () => ID }) chatId: string,
    @Args('filter', { nullable: true })
    filter: ChatMessagesFilterInput | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChatMessageEntity[]> {
    const isAdmin = user.role === UserRole.ADMIN;
    await this.chatService.ensureChatAccess(chatId, user.id, isAdmin);
    const messages = await this.chatService.getMessages(chatId, {
      limit: filter?.limit,
      cursor: filter?.cursor,
    });
    const chat = await this.chatService.findChatById(chatId);
    const chatUserId = chat.user.toString();
    return messages.map((m) => toMessageEntity(m, chatUserId));
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ChatMessageEntity, {
    description:
      'Отправить сообщение. chatId не передавать при первом сообщении — чат создастся.',
  })
  async sendMessage(
    @Args('input') input: SendMessageInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChatMessageEntity> {
    const { chat, message } = await this.chatService.sendMessage(
      user.id,
      input.body,
      input.chatId ?? undefined,
    );
    const chatUserId = chat.user.toString();
    return toMessageEntity(message, chatUserId);
  }
}
