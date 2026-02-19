import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ChatStatus } from './chat.enums';

@Schema({ timestamps: true })
export class Chat {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ChatStatus,
    default: ChatStatus.OPEN,
  })
  status: ChatStatus;

  /** Админ, назначенный на чат (опционально). */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ChatDocument = HydratedDocument<Chat>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Chat' })
  chat: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  sender: Types.ObjectId;

  @Prop({ required: true })
  body: string;

  /** Когда сообщение прочитано (админом или пользователем). */
  @Prop({ type: Date })
  readAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type MessageDocument = HydratedDocument<Message>;

export const ChatSchema = SchemaFactory.createForClass(Chat);
export const MessageSchema = SchemaFactory.createForClass(Message);

ChatSchema.index({ user: 1 });
ChatSchema.index({ status: 1 });
ChatSchema.index({ assignedTo: 1 });
ChatSchema.index({ updatedAt: -1 });

MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ chat: 1, readAt: 1 });
