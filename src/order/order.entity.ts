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

  /** Удобочитаемый номер заявки (E-000001) для документов и чеков */
  @Field(() => String, { nullable: true })
  number?: string;

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

/** Результат инициализации оплаты картой (T-Bank EACQ) */
@ObjectType('CreateOrderCardPaymentResult')
export class CreateOrderCardPaymentResult {
  @Field(() => String, {
    description: 'Идентификатор платежа (PaymentId) для открытия формы',
  })
  paymentId: string;

  @Field(() => String, {
    description: 'URL платёжной формы (для редиректа или iframe)',
  })
  paymentUrl: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус (Success и т.д.)',
  })
  status?: string;
}

@ObjectType('OrderPaymentStatusItem')
export class OrderPaymentStatusItem {
  @Field(() => String, { nullable: true })
  paymentId?: string;

  @Field(() => String, { nullable: true })
  status?: string;
}

/** Результат синхронизации статуса оплаты заказа с T-Bank EACQ */
@ObjectType('OrderPaymentSyncResult')
export class OrderPaymentSyncResult {
  @Field(() => OrderStatus, { description: 'Текущий статус заказа' })
  status: OrderStatus;

  @Field(() => Boolean, {
    description: 'Был ли обновлён статус заказа (например на PAID)',
  })
  updated: boolean;

  @Field(() => [OrderPaymentStatusItem], {
    nullable: true,
    description: 'Платежи по заказу из T-Bank',
  })
  payments?: OrderPaymentStatusItem[];
}
