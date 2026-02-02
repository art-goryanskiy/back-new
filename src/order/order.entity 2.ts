import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { OrderStatus, OrderCustomerType } from './order.schema';

registerEnumType(OrderStatus, { name: 'OrderStatus' });
registerEnumType(OrderCustomerType, { name: 'OrderCustomerType' });

@ObjectType()
export class OrderLineLearnerEntity {
  @Field(() => String)
  lastName: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String, { nullable: true })
  middleName?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;
}

@ObjectType()
export class OrderLineEntity {
  @Field(() => ID)
  programId: string;

  @Field(() => String)
  programTitle: string;

  @Field(() => Float)
  hours: number;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  lineAmount: number;

  @Field(() => [OrderLineLearnerEntity])
  learners: OrderLineLearnerEntity[];
}

@ObjectType()
export class OrderEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => OrderCustomerType)
  customerType: OrderCustomerType;

  @Field(() => ID, { nullable: true })
  organizationId?: string;

  @Field(() => String, { nullable: true })
  contactEmail?: string;

  @Field(() => String, { nullable: true })
  contactPhone?: string;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => [OrderLineEntity])
  lines: OrderLineEntity[];

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
