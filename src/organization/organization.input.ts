import { ArgsType, Field, Int, InputType } from '@nestjs/graphql';
import { OrganizationTypeGql } from './organization.entity';

@ArgsType()
export class OrganizationSuggestionsArgs {
  @Field(() => String)
  query: string;

  @Field(() => Int, { nullable: true })
  count?: number;
}

@InputType()
export class SetMyWorkPlaceByInnInput {
  @Field(() => String)
  inn: string;

  @Field(() => String, { nullable: true })
  kpp?: string;
}

@InputType()
export class SetMyWorkPlaceManualInput {
  @Field(() => OrganizationTypeGql)
  type: OrganizationTypeGql;

  @Field(() => String)
  inn: string;

  @Field(() => String, { nullable: true })
  kpp?: string;

  @Field(() => String)
  ogrn: string;

  @Field(() => String, { nullable: true })
  displayName?: string;

  // LEGAL
  @Field(() => String, { nullable: true })
  fullName?: string;

  @Field(() => String, { nullable: true })
  shortName?: string;

  @Field(() => String, { nullable: true })
  opfFull?: string;

  @Field(() => String, { nullable: true })
  opfShort?: string;

  // INDIVIDUAL
  @Field(() => String, { nullable: true })
  fioLast?: string;

  @Field(() => String, { nullable: true })
  fioFirst?: string;

  @Field(() => String, { nullable: true })
  fioMiddle?: string;

  @Field(() => String, { nullable: true })
  fioFull?: string;

  // Addresses
  @Field(() => String, { nullable: true })
  legalAddress?: string;

  @Field(() => String, { nullable: true })
  actualAddress?: string;

  @Field(() => Boolean, { nullable: true })
  actualSameAsLegal?: boolean;

  // Contacts
  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;
}

