import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './chat.schema';
import { Message, MessageDocument } from './chat.schema';
import { ChatStatus } from './chat.enums';
import type { AdminChatsFilterInput } from './chat.input';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/schemas/user.schema';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private userService: UserService,
    @Optional()
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway?: ChatGateway,
  ) {}

  /** Чат текущего пользователя (один на пользователя). Создаётся при первом сообщении. */
  async findOrCreateChatByUser(userId: string): Promise<ChatDocument> {
    let chat = await this.chatModel
      .findOne({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(1)
      .exec();
    if (!chat) {
      chat = await this.chatModel.create({
        user: new Types.ObjectId(userId),
        status: ChatStatus.OPEN,
      });
    }
    return chat;
  }

  async findChatById(chatId: string): Promise<ChatDocument> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  /** Проверка доступа: пользователь — только свой чат, админ — любой. */
  async ensureChatAccess(
    chatId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<ChatDocument> {
    const chat = await this.findChatById(chatId);
    if (isAdmin) return chat;
    if (chat.user.toString() !== userId) {
      throw new ForbiddenException('Access denied to this chat');
    }
    return chat;
  }

  async getMessages(
    chatId: string,
    opts: { limit?: number; cursor?: string },
  ): Promise<MessageDocument[]> {
    const limit = Math.min(opts.limit ?? 50, 100);
    const query: Record<string, unknown> = { chat: new Types.ObjectId(chatId) };
    if (opts.cursor) {
      const cursorDoc = await this.messageModel.findById(opts.cursor).exec();
      if (cursorDoc) {
        query.createdAt = { $lt: cursorDoc.createdAt };
      }
    }
    const messages = await this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return messages.reverse();
  }

  /** Отправить сообщение. Если chatId не передан — создаётся новый чат (первое сообщение пользователя). */
  async sendMessage(
    senderId: string,
    body: string,
    chatId?: string,
  ): Promise<{ chat: ChatDocument; message: MessageDocument }> {
    const user = await this.userService.findById(senderId);
    const isAdmin = user.role === UserRole.ADMIN;

    let chat: ChatDocument;
    if (chatId) {
      chat = await this.ensureChatAccess(chatId, senderId, isAdmin);
    } else {
      if (isAdmin) {
        throw new ForbiddenException('Admin must specify chatId to reply');
      }
      chat = await this.findOrCreateChatByUser(senderId);
    }

    const message = await this.messageModel.create({
      chat: chat._id,
      sender: new Types.ObjectId(senderId),
      body: body.trim(),
    });

    if (isAdmin) {
      await this.markMessagesFromUserAsRead(chat._id.toString());
    }

    chat.updatedAt = new Date();
    await chat.save();

    if (this.chatGateway) {
      this.chatGateway.emitNewMessage(
        chat.user.toString(),
        chat.assignedTo?.toString(),
        chat._id.toString(),
        {
          id: message._id.toString(),
          senderId: message.sender.toString(),
          body: message.body,
          createdAt: (message.createdAt ?? new Date()).toISOString(),
          isFromAdmin: isAdmin,
        },
      );
    }

    return { chat, message };
  }

  /** Пометить сообщения от пользователя (владельца чата) как прочитанные. */
  async markMessagesFromUserAsRead(chatId: string): Promise<void> {
    const chat = await this.findChatById(chatId);
    const userId = chat.user.toString();
    await this.messageModel
      .updateMany(
        { chat: chat._id, sender: new Types.ObjectId(userId), readAt: null },
        { $set: { readAt: new Date() } },
      )
      .exec();
  }

  /** Список чатов для админа с фильтром. */
  async adminFindChats(
    adminId: string,
    filter?: AdminChatsFilterInput,
  ): Promise<ChatDocument[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.assignedToMe) {
      query.assignedTo = new Types.ObjectId(adminId);
    }
    const limit = Math.min(filter?.limit ?? 20, 100);
    const offset = filter?.offset ?? 0;
    const chats = await this.chatModel
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('user', 'email firstName lastName')
      .exec();
    return chats as ChatDocument[];
  }

  /** Последнее сообщение в чате (превью). */
  async getLastMessagePreview(chatId: Types.ObjectId): Promise<string | null> {
    const msg = await this.messageModel
      .findOne({ chat: chatId })
      .sort({ createdAt: -1 })
      .select('body')
      .lean()
      .exec();
    if (!msg?.body) return null;
    const body = String(msg.body);
    return body.length > 80 ? body.slice(0, 77) + '...' : body;
  }

  /** Непрочитанных сообщений от пользователя в чате (для админа). */
  async countUnreadFromUser(chatId: string): Promise<number> {
    const chat = await this.findChatById(chatId);
    return this.messageModel
      .countDocuments({
        chat: chat._id,
        sender: chat.user,
        readAt: null,
      })
      .exec();
  }

  /** Непрочитанных сообщений от админа в чате (для владельца чата). */
  async countUnreadFromAdmin(chatId: string): Promise<number> {
    const chat = await this.findChatById(chatId);
    return this.messageModel
      .countDocuments({
        chat: chat._id,
        sender: { $ne: chat.user },
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      })
      .exec();
  }

  /** Пометить сообщения от админа в чате как прочитанные (при открытии чата пользователем). */
  async markMessagesFromAdminAsRead(chatId: string): Promise<void> {
    const chat = await this.findChatById(chatId);
    await this.messageModel
      .updateMany(
        {
          chat: chat._id,
          sender: { $ne: chat.user },
          $or: [{ readAt: null }, { readAt: { $exists: false } }],
        },
        { $set: { readAt: new Date() } },
      )
      .exec();
  }

  async adminAssignChat(
    chatId: string,
    assignToUserId: string | undefined,
    _adminId: string,
  ): Promise<ChatDocument> {
    const chat = await this.findChatById(chatId);
    if (assignToUserId) {
      const target = await this.userService.findById(assignToUserId);
      if (target.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Can only assign to admin user');
      }
      chat.assignedTo = new Types.ObjectId(assignToUserId);
    } else {
      chat.assignedTo = undefined;
    }
    chat.updatedAt = new Date();
    await chat.save();
    return chat;
  }

  async adminSetChatStatus(
    chatId: string,
    status: ChatStatus,
  ): Promise<ChatDocument> {
    const chat = await this.findChatById(chatId);
    chat.status = status;
    chat.updatedAt = new Date();
    await chat.save();
    return chat;
  }

  /** Для админа: открыть чат и пометить сообщения пользователя как прочитанные. */
  async adminOpenChatAndMarkRead(chatId: string): Promise<ChatDocument> {
    const chat = await this.findChatById(chatId);
    await this.markMessagesFromUserAsRead(chatId);
    return chat;
  }
}
