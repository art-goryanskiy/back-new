import { Field, InputType } from '@nestjs/graphql';

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
export class RequestPasswordResetInput {
  @Field(() => String)
  email: string;
}

@InputType()
export class ResetPasswordInput {
  @Field(() => String)
  token: string;

  @Field(() => String)
  password: string;

  @Field(() => String)
  confirmPassword: string;
}

@InputType()
export class ChangeMyPasswordInput {
  @Field(() => String)
  currentPassword: string;

  @Field(() => String)
  password: string;

  @Field(() => String)
  confirmPassword: string;
}
