import { Field, ID, InputType, GraphQLISODateTime } from '@nestjs/graphql';
import { UserRole } from './user.schema';

@InputType()
export class LoginInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  password: string;
}

@InputType()
export class RegisterInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  password: string;

  @Field(() => String)
  confirmPassword: string;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  phone?: string;
}

@InputType()
export class VerifyEmailInput {
  @Field(() => String)
  token: string;
}

@InputType()
export class RequestEmailVerificationInput {
  @Field(() => String)
  email: string;
}

@InputType()
export class PassportInfoInput {
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

@InputType()
export class EducationInfoInput {
  @Field(() => String, { nullable: true })
  qualification?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  documentIssuedAt?: Date;
}

@InputType()
export class UpdateMyProfileInput {
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

  @Field(() => PassportInfoInput, { nullable: true })
  passport?: PassportInfoInput;

  @Field(() => String, { nullable: true })
  passportRegistrationAddress?: string;

  @Field(() => String, { nullable: true })
  residentialAddress?: string;

  @Field(() => EducationInfoInput, { nullable: true })
  education?: EducationInfoInput;

  @Field(() => ID, { nullable: true })
  workPlaceId?: string;

  @Field(() => String, { nullable: true })
  position?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  snils?: string;

  @Field(() => String, { nullable: true })
  avatar?: string;
}

@InputType()
export class AdminCreateUserInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  password: string;

  @Field(() => UserRole, { nullable: true })
  role?: UserRole;

  @Field(() => Boolean, { nullable: true })
  isBlocked?: boolean;

  @Field(() => UpdateMyProfileInput, { nullable: true })
  profile?: UpdateMyProfileInput;
}

@InputType()
export class AdminUserFilterInput {
  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => Boolean, { nullable: true })
  isBlocked?: boolean;

  @Field(() => Number, { nullable: true })
  limit?: number;

  @Field(() => Number, { nullable: true })
  offset?: number;
}

@InputType()
export class AdminUpdateUserInput {
  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  password?: string;

  @Field(() => Boolean, { nullable: true })
  isBlocked?: boolean;

  @Field(() => UpdateMyProfileInput, { nullable: true })
  profile?: UpdateMyProfileInput;
}
