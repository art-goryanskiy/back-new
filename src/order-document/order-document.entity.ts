import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { OrderDocumentKind } from './order-document.schema';

registerEnumType(OrderDocumentKind, { name: 'OrderDocumentKind' });

@ObjectType('OrderDocument')
export class OrderDocumentEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  orderId: string;

  @Field(() => OrderDocumentKind)
  kind: OrderDocumentKind;

  @Field(() => String, { description: 'Ссылка на PDF' })
  fileUrl: string;

  @Field(() => GraphQLISODateTime)
  documentDate: Date;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
