import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class PendingRegistration {
  @Prop({ required: true, unique: true })
  email: string; // normalized lowercase

  @Prop({ required: true })
  passwordHash: string; // bcrypt hash

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  phone?: string;

  @Prop({ required: true, unique: true })
  tokenHash: string; // sha256(token)

  @Prop({ required: true })
  expiresAt: Date;
}

export const PendingRegistrationSchema =
  SchemaFactory.createForClass(PendingRegistration);

export type PendingRegistrationDocument = HydratedDocument<PendingRegistration>;

// TTL: автоудаление после expiresAt
PendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
