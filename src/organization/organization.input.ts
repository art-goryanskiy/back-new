import { ArgsType, Field, Int, InputType } from '@nestjs/graphql';

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

