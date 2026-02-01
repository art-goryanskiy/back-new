import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { OrderStatus, OrderCustomerType } from './order.enums';

@ObjectType('OrderLineLearner')
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

@ObjectType('OrderLine')
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

@ObjectType('Order')
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

/** Результат создания одноразовой ссылки СБП (T-Bank) для оплаты заказа */
@ObjectType('CreateOrderSbpLinkResult')
export class CreateOrderSbpLinkResult {
  @Field(() => String, { description: 'URL для перехода на оплату по СБП' })
  url: string;

  @Field(() => String, { description: 'Идентификатор ссылки (qrId) в T-Bank' })
  qrId: string;

  @Field(() => GraphQLISODateTime, {
    description: 'Срок действия ссылки',
  })
  dueDate: Date;

  @Field(() => String, {
    nullable: true,
    description: 'QR-код в base64 (image/png) для отображения',
  })
  qrImageBase64?: string;
}

/** Результат выставления счёта (T-Bank) для оплаты заказа */
@ObjectType('CreateOrderInvoiceResult')
export class CreateOrderInvoiceResult {
  @Field(() => String, { description: 'Ссылка на PDF счёта' })
  pdfUrl: string;

  @Field(() => String, { description: 'Идентификатор счёта в T-Bank' })
  invoiceId: string;

  @Field(() => String, {
    nullable: true,
    description: 'Ссылка на счёт в личном кабинете T-Бизнес',
  })
  incomingInvoiceUrl?: string;
}

/** Статус выставленного счёта (T-Bank) */
@ObjectType('OrderInvoiceInfoResult')
export class OrderInvoiceInfoResult {
  @Field(() => String, {
    description: 'Статус счёта в T-Bank (например SUBMITTED)',
  })
  status: string;
}

/** Информация о ссылке СБП (T-Bank) */
@ObjectType('OrderSbpLinkInfoResult')
export class OrderSbpLinkInfoResult {
  @Field(() => String, { description: 'Идентификатор ссылки (qrId)' })
  qrId: string;

  @Field(() => String, { description: 'URL для оплаты по СБП' })
  paymentUrl: string;

  @Field(() => String, { description: 'Тип ссылки (например Onetime)' })
  type: string;

  @Field(() => String, {
    description: 'Статус ссылки в T-Bank (например Ready)',
  })
  status: string;

  @Field(() => String, { description: 'Номер счёта' })
  accountNumber: string;
}
