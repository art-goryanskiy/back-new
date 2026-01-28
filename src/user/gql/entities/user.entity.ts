import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { UserRole } from './user-role.gql';
import { UserProfileEntity } from './user-profile.entity';

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

  @Field(() => Boolean)
  mustChangePassword: boolean;

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
