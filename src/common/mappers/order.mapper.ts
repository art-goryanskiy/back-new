import type { OrderDocument } from 'src/order/order.schema';
import type {
  OrderEntity,
  OrderLineEntity,
  OrderLineLearnerEntity,
} from 'src/order/order.entity';
import { extractId } from './base.mapper';

function toOrderLineLearnerEntity(
  l: { lastName: string; firstName: string; middleName?: string; email?: string; phone?: string },
): OrderLineLearnerEntity {
  return {
    lastName: l.lastName,
    firstName: l.firstName,
    middleName: l.middleName,
    email: l.email,
    phone: l.phone,
  };
}

function toOrderLineEntity(line: OrderDocument['lines'][0]): OrderLineEntity {
  return {
    programId: (line.program as { toString: () => string }).toString(),
    programTitle: line.programTitle,
    hours: line.hours,
    price: line.price,
    quantity: line.quantity,
    lineAmount: line.lineAmount,
    learners: (line.learners ?? []).map(toOrderLineLearnerEntity),
  };
}

export function toOrderEntity(order: OrderDocument | null): OrderEntity | null {
  if (!order) return null;

  const obj = order.toObject();
  const withTimestamps = obj as typeof obj & { createdAt?: Date; updatedAt?: Date };

  return {
    id: extractId(order),
    userId: order.user.toString(),
    customerType: order.customerType,
    organizationId: order.organization?.toString(),
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    status: order.status,
    totalAmount: order.totalAmount,
    lines: (order.lines ?? []).map(toOrderLineEntity),
    createdAt: withTimestamps.createdAt ?? new Date(),
    updatedAt: withTimestamps.updatedAt ?? new Date(),
  };
}

export function toOrderEntityArray(orders: OrderDocument[]): OrderEntity[] {
  return orders.map(toOrderEntity).filter((o): o is OrderEntity => o !== null);
}
