import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
} from '@nestjs/graphql';
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

  @Field(() => GraphQLISODateTime, { nullable: true })
  dateOfBirth?: Date;

  @Field(() => String, { nullable: true })
  citizenship?: string;

  @Field(() => String, { nullable: true })
  passportSeries?: string;

  @Field(() => String, { nullable: true })
  passportNumber?: string;

  @Field(() => String, { nullable: true })
  passportIssuedBy?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  passportIssuedAt?: Date;

  @Field(() => String, { nullable: true })
  passportDepartmentCode?: string;

  @Field(() => String, { nullable: true })
  snils?: string;

  @Field(() => String, { nullable: true })
  educationQualification?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  educationDocumentIssuedAt?: Date;

  @Field(() => String, { nullable: true })
  passportRegistrationAddress?: string;

  @Field(() => String, { nullable: true })
  residentialAddress?: string;

  @Field(() => String, { nullable: true })
  workPlaceName?: string;

  @Field(() => String, { nullable: true })
  position?: string;
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

  /** Организация по ИНН или наименованию: поиск в БД или создание из DaData, добавление в места работы. При указании приоритет над organizationId. */
  @Field(() => String, { nullable: true })
  organizationQuery?: string;

  @Field(() => String, { nullable: true })
  contactEmail?: string;

  @Field(() => String, { nullable: true })
  contactPhone?: string;

  /** Параметры обучения для заявки на обучение */
  @Field(() => GraphQLISODateTime, { nullable: true })
  trainingStartDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  trainingEndDate?: Date;

  @Field(() => String, { nullable: true })
  trainingForm?: string;

  @Field(() => String, { nullable: true })
  trainingLanguage?: string;

  @Field(() => String, { nullable: true })
  headPosition?: string;

  @Field(() => String, { nullable: true })
  headFullName?: string;

  @Field(() => String, { nullable: true })
  contactPersonName?: string;

  @Field(() => String, { nullable: true })
  contactPersonPosition?: string;

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

@InputType()
export class AdminOrdersFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  status?: OrderStatus;

  @Field(() => ID, { nullable: true, description: 'Фильтр по пользователю' })
  userId?: string;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Int, { nullable: true })
  offset?: number;
}

@InputType()
export class AdminSetOrderTrainingDatesInput {
  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Срок обучения: начало',
  })
  trainingStartDate?: Date;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Срок обучения: окончание',
  })
  trainingEndDate?: Date;
}
