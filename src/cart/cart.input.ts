import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddToCartInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  @Field(() => Int)
  quantity: number;
}

@InputType()
export class UpdateCartItemInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  @Field(() => Int)
  quantity: number;
}

@InputType()
export class RemoveFromCartInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;
}
