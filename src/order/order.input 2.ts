import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { OrderCustomerType } from './order.schema';

@InputType()
export class OrderLineLearnerInput {
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

@InputType()
export class CreateOrderLineInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => [OrderLineLearnerInput])
  learners: OrderLineLearnerInput[];
}

@InputType()
export class CreateOrderFromCartInput {
  @Field(() => OrderCustomerType)
  customerType: OrderCustomerType;

  @Field(() => ID, { nullable: true })
  organizationId?: string;

  @Field(() => String, { nullable: true })
  contactEmail?: string;

  @Field(() => String, { nullable: true })
  contactPhone?: string;

  @Field(() => [CreateOrderLineInput])
  lines: CreateOrderLineInput[];
}

@InputType()
export class MyOrdersFilterInput {
  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Int, { nullable: true })
  offset?: number;
}
