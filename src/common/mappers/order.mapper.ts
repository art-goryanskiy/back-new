import type { OrderDocument } from 'src/order/order.schema';
import type {
  OrderEntity,
  OrderLineEntity,
  OrderLineLearnerEntity,
} from 'src/order/order.entity';
import { extractId } from './base.mapper';

type OrderLearnerLean = {
  lastName: string;
  firstName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  citizenship?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: Date;
  passportDepartmentCode?: string;
  snils?: string;
  educationQualification?: string;
  educationDocumentIssuedAt?: Date;
  passportRegistrationAddress?: string;
  residentialAddress?: string;
  workPlaceName?: string;
  position?: string;
};

type OrderLineLean = {
  program: { toString: () => string };
  programTitle: string;
  subProgramIndex?: number;
  subProgramTitle?: string;
  hours: number;
  price: number;
  quantity: number;
  lineAmount: number;
  learners?: OrderLearnerLean[];
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
  statusChangedAt?: Date;
  totalAmount: number;
  lines?: OrderLineLean[];
  createdAt?: Date;
  updatedAt?: Date;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  trainingForm?: string;
  trainingLanguage?: string;
  headPosition?: string;
  headFullName?: string;
  contactPersonName?: string;
  contactPersonPosition?: string;
};

function toOrderLineLearnerEntity(l: OrderLearnerLean): OrderLineLearnerEntity {
  return {
    lastName: l.lastName,
    firstName: l.firstName,
    middleName: l.middleName,
    email: l.email,
    phone: l.phone,
    dateOfBirth: l.dateOfBirth,
    citizenship: l.citizenship,
    passportSeries: l.passportSeries,
    passportNumber: l.passportNumber,
    passportIssuedBy: l.passportIssuedBy,
    passportIssuedAt: l.passportIssuedAt,
    passportDepartmentCode: l.passportDepartmentCode,
    snils: l.snils,
    educationQualification: l.educationQualification,
    educationDocumentIssuedAt: l.educationDocumentIssuedAt,
    passportRegistrationAddress: l.passportRegistrationAddress,
    residentialAddress: l.residentialAddress,
    workPlaceName: l.workPlaceName,
    position: l.position,
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
    subProgramIndex: line?.subProgramIndex,
    subProgramTitle: line?.subProgramTitle,
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
  const o = order as OrderLean & {
    id?: string;
    organization?: { _id?: { toString: () => string }; displayName?: string };
  };
  const org = o.organization as
    | { _id?: { toString: () => string }; displayName?: string }
    | undefined;
  const organizationId =
    org && typeof org === 'object' && org._id
      ? org._id.toString()
      : (o.organization as { toString?: () => string } | undefined)?.toString?.();
  const customerDisplayName =
    (org && typeof org === 'object' && org.displayName) ||
    o.headFullName ||
    o.contactPersonName ||
    '—';

  return {
    id: typeof o._id !== 'undefined' ? extractId({ _id: o._id }) : extractId(o),
    number: o.number,
    userId: (o.user as { toString: () => string }).toString(),
    customerType: o.customerType as OrderEntity['customerType'],
    organizationId: organizationId ?? undefined,
    customerDisplayName,
    contactEmail: o.contactEmail,
    contactPhone: o.contactPhone,
    status: o.status as OrderEntity['status'],
    statusChangedAt: o.statusChangedAt,
    totalAmount: o.totalAmount,
    lines: (o.lines ?? []).map(toOrderLineEntity),
    createdAt: o.createdAt ?? new Date(),
    updatedAt: o.updatedAt ?? new Date(),
    trainingStartDate: o.trainingStartDate,
    trainingEndDate: o.trainingEndDate,
    trainingForm: o.trainingForm,
    trainingLanguage: o.trainingLanguage,
    headPosition: o.headPosition,
    headFullName: o.headFullName,
    contactPersonName: o.contactPersonName,
    contactPersonPosition: o.contactPersonPosition,
  };
}

export function toOrderEntityArray(
  orders: (OrderDocument | OrderLean)[],
): OrderEntity[] {
  return orders
    .map(toOrderEntity)
    .filter((o): o is OrderEntity => o !== null);
}
