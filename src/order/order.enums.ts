import { registerEnumType } from '@nestjs/graphql';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  DOCUMENTS_GENERATED = 'DOCUMENTS_GENERATED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum OrderCustomerType {
  SELF = 'SELF',
  INDIVIDUAL = 'INDIVIDUAL',
  ORGANIZATION = 'ORGANIZATION',
}

registerEnumType(OrderStatus, { name: 'OrderStatus' });
registerEnumType(OrderCustomerType, { name: 'OrderCustomerType' });
