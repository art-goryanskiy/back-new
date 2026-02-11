import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NewsAttachmentEntity {
  @Field(() => String)
  type: string;

  @Field(() => String, { nullable: true })
  url?: string;

  @Field(() => String, { nullable: true })
  title?: string;
}

@ObjectType()
export class NewsItemEntity {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  text: string;

  @Field(() => String, { description: 'ISO 8601 date' })
  date: string;

  @Field(() => [NewsAttachmentEntity], { nullable: true })
  attachments?: NewsAttachmentEntity[];

  @Field(() => String, {
    nullable: true,
    description: 'Ссылка на запись во ВКонтакте',
  })
  vkUrl?: string;
}
