import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { User } from './user.schema';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class PassportInfo {
  @Prop()
  series?: string;

  @Prop()
  number?: string;

  @Prop()
  issuedBy?: string;

  @Prop()
  issuedAt?: Date;

  @Prop()
  departmentCode?: string; // код подразделения (строка, часто с 0 в начале)
}

@Schema({ _id: false })
export class EducationInfo {
  @Prop()
  qualification?: string;

  @Prop()
  documentIssuedAt?: Date;
}

/** Запись о месте работы в профиле (до 5, одно основное). */
@Schema({ _id: false })
export class WorkPlaceEntry {
  @Prop({ required: true, type: Types.ObjectId })
  organization: Types.ObjectId;

  @Prop()
  position?: string;

  @Prop({ required: true, default: false })
  isPrimary: boolean;
}

export const MAX_WORK_PLACES = 5;

@Schema({
  timestamps: true,
})
export class UserProfile {
  @Prop({ required: true, ref: User.name, type: Types.ObjectId, unique: true })
  user: Types.ObjectId;

  // ФИО
  @Prop()
  lastName?: string;

  @Prop()
  firstName?: string;

  @Prop()
  middleName?: string;

  // ДР / гражданство
  @Prop()
  dateOfBirth?: Date;

  @Prop()
  citizenship?: string;

  // Контакты (email — в User)
  @Prop()
  phone?: string;

  // Паспорт
  @Prop({ type: PassportInfo })
  passport?: PassportInfo;

  // Адреса
  @Prop()
  passportRegistrationAddress?: string;

  @Prop()
  residentialAddress?: string;

  // Образование
  @Prop({ type: EducationInfo })
  education?: EducationInfo;

  /** Места работы (до 5, одно с isPrimary: true). */
  @Prop({ type: [WorkPlaceEntry], default: undefined })
  workPlaces?: WorkPlaceEntry[];

  /** @deprecated Используйте workPlaces. Оставлено для обратной совместимости при чтении. */
  @Prop({ type: Types.ObjectId, required: false })
  workPlaceId?: Types.ObjectId;

  /** @deprecated Используйте workPlaces[].position. */
  @Prop()
  position?: string;

  // СНИЛС
  @Prop()
  snils?: string;

  @Prop()
  avatar?: string;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
export type UserProfileDocument = HydratedDocument<UserProfile>;
