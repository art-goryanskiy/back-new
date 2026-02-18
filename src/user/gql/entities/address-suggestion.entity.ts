import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AddressSuggestionEntity {
  @Field(() => String)
  value: string;

  @Field(() => String, { nullable: true })
  unrestrictedValue?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  region?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  street?: string;

  @Field(() => String, { nullable: true })
  house?: string;

  @Field(() => String, { nullable: true })
  flat?: string;

  @Field(() => String, { nullable: true })
  fiasId?: string;

  @Field(() => String, { nullable: true })
  kladrId?: string;

  @Field(() => String, { nullable: true })
  geoLat?: string;

  @Field(() => String, { nullable: true })
  geoLon?: string;
}
