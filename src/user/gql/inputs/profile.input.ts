import { Field, ID, InputType, GraphQLISODateTime } from '@nestjs/graphql';

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
