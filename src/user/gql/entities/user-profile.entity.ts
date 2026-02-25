import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';
import { OrganizationEntity } from 'src/organization/organization.entity';

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

/** Место работы в профиле (organization резолвится отдельно по organizationId). */
@ObjectType()
export class UserWorkPlaceEntity {
  /** Для резолвера organization; не экспонируется в схеме. */
  organizationId?: string;

  @Field(() => OrganizationEntity)
  organization: OrganizationEntity;

  @Field(() => String, { nullable: true })
  position?: string;

  @Field(() => Boolean)
  isPrimary: boolean;
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

  @Field(() => [UserWorkPlaceEntity], { nullable: true })
  workPlaces?: UserWorkPlaceEntity[];

  @Field(() => String, { nullable: true })
  snils?: string;

  @Field(() => String, { nullable: true })
  avatar?: string;
}
