import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ChatStatus } from './chat.enums';

registerEnumType(ChatStatus, { name: 'ChatStatus' });

@ObjectType('ChatMessage')
export class ChatMessageEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  chatId: string;

  @Field(() => ID)
  senderId: string;

  @Field(() => Boolean, {
    description: 'Сообщение от админа (иначе от пользователя чата)',
  })
  isFromAdmin: boolean;

  @Field()
  body: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  readAt?: Date;
}

@ObjectType('Chat')
export class ChatEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => ChatStatus)
  status: ChatStatus;

  @Field(() => ID, { nullable: true })
  assignedToId?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  /** Превью последнего сообщения. */
  @Field(() => String, { nullable: true })
  lastMessagePreview?: string;

  /** Количество непрочитанных сообщений от пользователя (для админа). */
  @Field(() => Int, { nullable: true })
  unreadCount?: number;
}
