import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum OrganizationTypeGql {
  LEGAL = 'LEGAL',
  INDIVIDUAL = 'INDIVIDUAL',
}

registerEnumType(OrganizationTypeGql, { name: 'OrganizationType' });

@ObjectType()
export class OrganizationEntity {
  @Field(() => ID)
  id: string;

  @Field(() => OrganizationTypeGql)
  type: OrganizationTypeGql;

  @Field(() => String)
  inn: string;

  @Field(() => String, { nullable: true })
  kpp?: string;

  @Field(() => String)
  ogrn: string;

  @Field(() => String)
  displayName: string;

  @Field(() => String, { nullable: true })
  fullName?: string;

  @Field(() => String, { nullable: true })
  shortName?: string;

  @Field(() => String, { nullable: true })
  opfFull?: string;

  @Field(() => String, { nullable: true })
  opfShort?: string;

  @Field(() => String, { nullable: true })
  fioLast?: string;

  @Field(() => String, { nullable: true })
  fioFirst?: string;

  @Field(() => String, { nullable: true })
  fioMiddle?: string;

  @Field(() => String, { nullable: true })
  fioFull?: string;

  @Field(() => String, { nullable: true })
  legalAddress?: string;

  @Field(() => String, { nullable: true })
  actualAddress?: string;

  @Field(() => String, { nullable: true, description: 'Расчётный счёт (р/с)' })
  bankAccount?: string;

  @Field(() => String, { nullable: true, description: 'Наименование банка' })
  bankName?: string;

  @Field(() => String, { nullable: true, description: 'БИК банка' })
  bik?: string;

  @Field(() => String, { nullable: true, description: 'Корреспондентский счёт (к/с)' })
  correspondentAccount?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;
}

@ObjectType()
export class OrganizationSuggestionEntity {
  @Field(() => OrganizationTypeGql)
  type: OrganizationTypeGql;

  @Field(() => String)
  inn: string;

  @Field(() => String, { nullable: true })
  kpp?: string;

  @Field(() => String)
  ogrn: string;

  @Field(() => String)
  displayName: string;

  @Field(() => String, { nullable: true })
  legalAddress?: string;
}

