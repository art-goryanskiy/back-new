import { Field, InputType } from '@nestjs/graphql';
import { UserRole } from '../../schemas/user.schema';
import { UpdateMyProfileInput } from './profile.input';

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
