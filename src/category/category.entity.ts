import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { CategoryType } from './category.schema';

registerEnumType(CategoryType, {
  name: 'CategoryType',
});

@ObjectType()
export class CategoryEntity {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  slug: string;

  @Field(() => ID, { nullable: true })
  parent?: string;

  @Field(() => String, { nullable: true })
  image?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => CategoryType, { nullable: true })
  type?: CategoryType;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => Number, { nullable: true })
  programsCount?: number;
}
