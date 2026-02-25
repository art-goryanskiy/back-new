import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AdminNotificationEntityType,
  AdminNotificationType,
} from './admin-notification.enums';

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

@Schema({ timestamps: true })
export class AdminNotification {
  @Prop({
    required: true,
    type: String,
    enum: AdminNotificationType,
  })
  type: AdminNotificationType;

  @Prop({
    required: true,
    type: String,
    enum: AdminNotificationEntityType,
  })
  entityType: AdminNotificationEntityType;

  @Prop({ required: true, type: String })
  entityId: string;

  @Prop({ required: true, type: String })
  title: string;

  @Prop({ required: true, type: String })
  message: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy: Types.ObjectId[];

  createdAt?: Date;
  updatedAt?: Date;
}

export type AdminNotificationDocument = HydratedDocument<AdminNotification>;

export const AdminNotificationSchema =
  SchemaFactory.createForClass(AdminNotification);

AdminNotificationSchema.index({ createdAt: -1 });
AdminNotificationSchema.index({ readBy: 1, createdAt: -1 });
AdminNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NINETY_DAYS_SECONDS },
);
