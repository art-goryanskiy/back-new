import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';

@InputType()
export class AdminUpdateOrderDocumentDateInput {
  @Field(() => ID)
  orderDocumentId: string;

  @Field(() => GraphQLISODateTime)
  documentDate: Date;
}

@InputType()
export class AdminGenerateOrderDocumentInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Дата документа (по умолчанию — сегодня)',
  })
  documentDate?: Date;
}
