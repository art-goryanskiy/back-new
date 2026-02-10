import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { OrderCustomerType, OrderStatus } from './order.enums';

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

  @Field(() => Int, { nullable: true })
  pricingIndex?: number;

  /** Индекс подпрограммы (для сопоставления с позицией корзины). */
  @Field(() => Int, { nullable: true })
  subProgramIndex?: number;

  @Field(() => Float)
  hours: number;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  lineAmount: number;

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
export class UpdateOrderInput {
  @Field(() => String, { nullable: true })
  contactEmail?: string;

  @Field(() => String, { nullable: true })
  contactPhone?: string;

  @Field(() => ID, { nullable: true })
  organizationId?: string | null;

  /** Организация по запросу: ИНН или наименование (поиск в БД или создание из DaData). При указании приоритет над organizationId. */
  @Field(() => String, { nullable: true })
  organizationQuery?: string;
}

@InputType()
export class MyOrdersFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  status?: OrderStatus;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Int, { nullable: true })
  offset?: number;
}
