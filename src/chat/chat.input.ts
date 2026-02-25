import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { ChatStatus } from './chat.enums';

@InputType()
export class SendMessageInput {
  @Field(() => ID, {
    nullable: true,
    description:
      'ID чата (для первого сообщения не передавать — чат создастся)',
  })
  chatId?: string;

  @Field({ description: 'Текст сообщения' })
  body: string;
}

@InputType()
export class ChatMessagesFilterInput {
  @Field(() => Int, { nullable: true, defaultValue: 50 })
  limit?: number;

  @Field({
    nullable: true,
    description: 'Курсор для пагинации (id последнего сообщения)',
  })
  cursor?: string;
}

@InputType()
export class AdminChatsFilterInput {
  @Field(() => ChatStatus, { nullable: true })
  status?: ChatStatus;

  @Field({
    nullable: true,
    description: 'Только чаты, назначенные на этого админа',
  })
  assignedToMe?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  offset?: number;
}

@InputType()
export class AdminAssignChatInput {
  @Field({ description: 'ID чата' })
  chatId: string;

  @Field({ nullable: true, description: 'ID админа (null — снять назначение)' })
  assignToUserId?: string;
}

@InputType()
export class AdminSetChatStatusInput {
  @Field({ description: 'ID чата' })
  chatId: string;

  @Field(() => ChatStatus)
  status: ChatStatus;
}
