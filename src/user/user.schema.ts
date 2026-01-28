import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Schema({
  timestamps: true,
})
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    enum: UserRole,
    default: UserRole.USER,
    type: String,
  })
  role: UserRole;

  @Prop({ type: Boolean, default: false })
  isBlocked: boolean;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  // (оставляем для обратной совместимости; основной источник — профиль)
  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  phone?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
export type UserDocument = HydratedDocument<User>;

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  // если уже bcrypt-хэш — не хэшируем повторно
  if (typeof this.password === 'string' && this.password.startsWith('$2')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.index({ role: 1 });
UserSchema.index({ isBlocked: 1 });
UserSchema.index({ isEmailVerified: 1 });

UserSchema.index({ firstName: 1 });
UserSchema.index({ lastName: 1 });
UserSchema.index({ phone: 1 });

UserSchema.index({ createdAt: -1 });

UserSchema.index(
  { email: 'text', firstName: 'text', lastName: 'text', phone: 'text' },
  { name: 'user_search_text_index' },
);
