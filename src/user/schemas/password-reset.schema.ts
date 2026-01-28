import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class PasswordReset {
  @Prop({ required: true })
  email: string; // normalized lowercase

  @Prop({ required: true, unique: true })
  tokenHash: string; // sha256(token)

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  usedAt?: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);
export type PasswordResetDocument = HydratedDocument<PasswordReset>;

PasswordResetSchema.index({ email: 1 });
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index(
  { usedAt: 1 },
  { partialFilterExpression: { usedAt: { $exists: true } } },
);
