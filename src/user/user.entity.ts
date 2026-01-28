import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { UserRole } from './user.schema';

registerEnumType(UserRole, {
  name: 'UserRole',
});

@ObjectType()
export class PassportInfoEntity {
  @Field(() => String, { nullable: true })
  series?: string;

  @Field(() => String, { nullable: true })
  number?: string;

  @Field(() => String, { nullable: true })
  issuedBy?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  issuedAt?: Date;

  @Field(() => String, { nullable: true })
  departmentCode?: string;
}

@ObjectType()
export class EducationInfoEntity {
  @Field(() => String, { nullable: true })
  qualification?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  documentIssuedAt?: Date;
}

@ObjectType()
export class UserProfileEntity {
  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  middleName?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dateOfBirth?: Date;

  @Field(() => String, { nullable: true })
  citizenship?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => PassportInfoEntity, { nullable: true })
  passport?: PassportInfoEntity;

  @Field(() => String, { nullable: true })
  passportRegistrationAddress?: string;

  @Field(() => String, { nullable: true })
  residentialAddress?: string;

  @Field(() => EducationInfoEntity, { nullable: true })
  education?: EducationInfoEntity;

  @Field(() => ID, { nullable: true })
  workPlaceId?: string;

  @Field(() => String, { nullable: true })
  position?: string;

  @Field(() => String, { nullable: true })
  snils?: string;

  @Field(() => String, { nullable: true })
  avatar?: string;
}

@ObjectType()
export class UserEntity {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => Boolean)
  isBlocked: boolean;

  @Field(() => Boolean)
  isEmailVerified: boolean;

  // (оставляем для совместимости)
  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => UserProfileEntity, { nullable: true })
  profile?: UserProfileEntity;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
