import { Field, InputType } from '@nestjs/graphql';
import { CategoryType } from './category.schema';

@InputType()
export class CreateCategoryInput {
  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  parent?: string;

  @Field(() => String, { nullable: true })
  image?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => CategoryType, { nullable: true })
  type?: CategoryType;
}

@InputType()
export class UpdateCategoryInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  parent?: string;

  @Field(() => String, { nullable: true })
  image?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => CategoryType, { nullable: true })
  type?: CategoryType;
}

@InputType()
export class CategoryFilterInput {
  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => String, { nullable: true })
  parent?: string;

  @Field(() => Number, { nullable: true })
  limit?: number;

  @Field(() => Number, { nullable: true })
  offset?: number;
}
