import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
})
export class RefreshToken {
  @Prop({
    ref: 'User',
    type: Types.ObjectId,
    required: true,
  })
  user: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string; // ИЗМЕНЕНО: храним хэш вместо токена

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: String, required: false })
  familyId?: string; // НОВОЕ: для отслеживания семейства токенов (reuse detection)
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

RefreshTokenSchema.index({ user: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Автоудаление истекших
RefreshTokenSchema.index({ familyId: 1 }); // НОВОЕ: для быстрого поиска семейства
