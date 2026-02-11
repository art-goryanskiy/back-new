import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class NewsFilterInput {
  @Field(() => Number, {
    nullable: true,
    description: 'Количество записей (по умолчанию 10, макс. 100)',
  })
  limit?: number;

  @Field(() => Number, {
    nullable: true,
    description: 'Смещение для пагинации',
  })
  offset?: number;
}
