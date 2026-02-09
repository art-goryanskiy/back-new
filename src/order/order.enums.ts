import { registerEnumType } from '@nestjs/graphql';

/** Статусы заказа: ожидает оплаты, оплачен, в работе, выполнен, отменен */
export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderCustomerType {
  SELF = 'SELF',
  INDIVIDUAL = 'INDIVIDUAL',
  ORGANIZATION = 'ORGANIZATION',
}

registerEnumType(OrderStatus, { name: 'OrderStatus' });
registerEnumType(OrderCustomerType, { name: 'OrderCustomerType' });
