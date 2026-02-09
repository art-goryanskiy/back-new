import type { OrderDocument } from 'src/order/order.schema';
import type {
  OrderEntity,
  OrderLineEntity,
  OrderLineLearnerEntity,
} from 'src/order/order.entity';
import { extractId } from './base.mapper';

type OrderLineLean = {
  program: { toString: () => string };
  programTitle: string;
  hours: number;
  price: number;
  quantity: number;
  lineAmount: number;
  learners?: Array<{
    lastName: string;
    firstName: string;
    middleName?: string;
    email?: string;
    phone?: string;
  }>;
};

type OrderLean = {
  _id: unknown;
  user: { toString: () => string };
  customerType: string;
  organization?: { toString: () => string };
  contactEmail?: string;
  contactPhone?: string;
  number?: string;
  status: string;
  totalAmount: number;
  lines?: OrderLineLean[];
  createdAt?: Date;
  updatedAt?: Date;
};

function toOrderLineLearnerEntity(l: {
  lastName: string;
  firstName: string;
  middleName?: string;
  email?: string;
  phone?: string;
}): OrderLineLearnerEntity {
  return {
    lastName: l.lastName,
    firstName: l.firstName,
    middleName: l.middleName,
    email: l.email,
    phone: l.phone,
  };
}

function toOrderLineEntity(line: OrderLineLean | undefined): OrderLineEntity {
  if (!line) {
    return {
      programId: '',
      programTitle: '',
      hours: 0,
      price: 0,
      quantity: 0,
      lineAmount: 0,
      learners: [],
    };
  }
  const program = line.program;
  return {
    programId: program?.toString?.() ?? '',
    programTitle: line?.programTitle ?? '',
    hours: line?.hours ?? 0,
    price: line?.price ?? 0,
    quantity: line?.quantity ?? 0,
    lineAmount: line?.lineAmount ?? 0,
    learners: (line?.learners ?? []).map(toOrderLineLearnerEntity),
  };
}

export function toOrderEntity(
  order: OrderDocument | OrderLean | null,
): OrderEntity | null {
  if (!order) return null;
  const o = order as OrderLean & { id?: string };
  return {
    id: typeof o._id !== 'undefined' ? extractId({ _id: o._id }) : extractId(o),
    number: o.number,
    userId: (o.user as { toString: () => string }).toString(),
    customerType: o.customerType as OrderEntity['customerType'],
    organizationId: o.organization?.toString(),
    contactEmail: o.contactEmail,
    contactPhone: o.contactPhone,
    status: o.status as OrderEntity['status'],
    totalAmount: o.totalAmount,
    lines: (o.lines ?? []).map(toOrderLineEntity),
    createdAt: o.createdAt ?? new Date(),
    updatedAt: o.updatedAt ?? new Date(),
  };
}

export function toOrderEntityArray(
  orders: (OrderDocument | OrderLean)[],
): OrderEntity[] {
  return orders
    .map(toOrderEntity)
    .filter((o): o is OrderEntity => o !== null);
}
