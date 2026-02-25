import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('AdminNotificationsFilterInput')
export class AdminNotificationsFilterInput {
  @Field(() => Int, { nullable: true, description: 'Лимит (до 100)' })
  limit?: number;

  @Field(() => Int, { nullable: true, description: 'Смещение (offset)' })
  offset?: number;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Только непрочитанные для текущего админа',
  })
  unreadOnly?: boolean;
}
