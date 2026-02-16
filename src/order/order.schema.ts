import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderStatus, OrderCustomerType } from './order.enums';

export { OrderStatus, OrderCustomerType };

@Schema({ _id: false })
export class OrderLineLearner {
  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  firstName: string;

  @Prop()
  middleName?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop()
  citizenship?: string;

  @Prop()
  passportSeries?: string;

  @Prop()
  passportNumber?: string;

  @Prop()
  passportIssuedBy?: string;

  @Prop()
  passportIssuedAt?: Date;

  @Prop()
  passportDepartmentCode?: string;

  @Prop()
  snils?: string;

  @Prop()
  educationQualification?: string;

  @Prop()
  educationDocumentIssuedAt?: Date;

  @Prop()
  passportRegistrationAddress?: string;

  @Prop()
  residentialAddress?: string;

  @Prop()
  workPlaceName?: string;

  @Prop()
  position?: string;
}

@Schema({ _id: false })
export class OrderLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Program' })
  program: Types.ObjectId;

  @Prop({ required: true })
  programTitle: string;

  /** Индекс подпрограммы в program.subPrograms[]. Если задан — строка заказа по подпрограмме. */
  @Prop({ required: false, type: Number, min: 0 })
  subProgramIndex?: number;

  @Prop()
  subProgramTitle?: string;

  @Prop({ required: true, type: Number })
  hours: number;

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ required: true, type: Number })
  quantity: number;

  @Prop({ required: true, type: Number })
  lineAmount: number;

  @Prop({ type: [OrderLineLearner], required: true })
  learners: OrderLineLearner[];
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user: Types.ObjectId;

  @Prop({ required: true, enum: OrderCustomerType, type: String })
  customerType: OrderCustomerType;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organization?: Types.ObjectId;

  @Prop()
  contactEmail?: string;

  @Prop()
  contactPhone?: string;

  /** Удобочитаемый номер заявки (E-000001), уникальный, для документов и чеков */
  @Prop({ type: String, unique: true, sparse: true })
  number?: string;

  @Prop({
    required: true,
    enum: OrderStatus,
    type: String,
    default: OrderStatus.AWAITING_PAYMENT,
  })
  status: OrderStatus;

  /** Дата и время последней смены статуса заявки */
  @Prop()
  statusChangedAt?: Date;

  @Prop({ required: true, type: Number })
  totalAmount: number;

  @Prop({ type: [OrderLine], required: true })
  lines: OrderLine[];

  /** T-Bank счёт: id счёта (invoiceId из ответа API) */
  @Prop()
  invoiceId?: string;

  /** T-Bank счёт: ссылка на PDF счёта */
  @Prop()
  invoicePdfUrl?: string;

  /** T-Bank счёт: дата/время выставления счёта */
  @Prop()
  invoiceSentAt?: Date;

  /** Параметры обучения для заявки на обучение */
  @Prop()
  trainingStartDate?: Date;

  @Prop()
  trainingEndDate?: Date;

  /** очная, очно-заочная, заочная, дистанционная */
  @Prop()
  trainingForm?: string;

  /** русский, крымскотатарский, украинский */
  @Prop()
  trainingLanguage?: string;

  /** Должность руководителя предприятия (организации) */
  @Prop()
  headPosition?: string;

  /** Ф.И.О. руководителя */
  @Prop()
  headFullName?: string;

  /** Должность руководителя в род. п. для преамбулы договора (напр. «Директора») */
  @Prop()
  headPositionGenitive?: string;

  /** Ф.И.О. руководителя в род. п. для преамбулы (напр. «Горянского Артема Юрьевича») */
  @Prop()
  headFullNameGenitive?: string;

  /** Контактное лицо: Ф.И.О. */
  @Prop()
  contactPersonName?: string;

  /** Контактное лицо: должность */
  @Prop()
  contactPersonPosition?: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ number: 1 }, { unique: true, sparse: true });
