import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Вид документа заявки */
export enum OrderDocumentKind {
  /** Заявка на обучение */
  TRAINING_APPLICATION = 'TRAINING_APPLICATION',
  /** Договор */
  CONTRACT = 'CONTRACT',
  /** Акт оказанных услуг */
  ACT = 'ACT',
}

@Schema({ timestamps: true })
export class OrderDocumentModel {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Order' })
  order: Types.ObjectId;

  @Prop({ required: true, enum: OrderDocumentKind, type: String })
  kind: OrderDocumentKind;

  /** Ссылка на файл (PDF) в хранилище */
  @Prop({ required: true })
  fileUrl: string;

  /** Дата документа (для договора/акта — может редактироваться админом) */
  @Prop({ required: true, type: Date })
  documentDate: Date;
}

export type OrderDocumentDocument = HydratedDocument<OrderDocumentModel>;
export const OrderDocumentSchema =
  SchemaFactory.createForClass(OrderDocumentModel);

OrderDocumentSchema.index({ order: 1 });
OrderDocumentSchema.index({ order: 1, kind: 1 });
