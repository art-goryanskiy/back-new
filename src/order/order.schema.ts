import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/user/schemas/user.schema';

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

  @Prop({ required: true, type: Number, min: 1 })
  quantity: number;

  @Prop({ required: true, type: Number })
  lineAmount: number;

  @Prop({ type: [OrderLineLearner], required: true })
  learners: OrderLineLearner[];
}

@Schema({
  timestamps: true,
})
export class Order {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name })
  user: Types.ObjectId;

  @Prop({ required: true, enum: OrderCustomerType, type: String })
  customerType: OrderCustomerType;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: false })
  organization?: Types.ObjectId;

  @Prop()
  contactEmail?: string;

  @Prop()
  contactPhone?: string;

  @Prop({ required: true, enum: OrderStatus, type: String, default: OrderStatus.SUBMITTED })
  status: OrderStatus;

  @Prop({ required: true, type: Number })
  totalAmount: number;

  @Prop({ type: Types.ObjectId, required: false })
  paymentId?: Types.ObjectId;

  @Prop({ type: [OrderLine], required: true })
  lines: OrderLine[];
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
