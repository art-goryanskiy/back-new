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
}

@Schema({ _id: false })
export class OrderLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Program' })
  program: Types.ObjectId;

  @Prop({ required: true })
  programTitle: string;

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

  @Prop({
    required: true,
    enum: OrderStatus,
    type: String,
    default: OrderStatus.SUBMITTED,
  })
  status: OrderStatus;

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
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
