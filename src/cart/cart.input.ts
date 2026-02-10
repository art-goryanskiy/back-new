import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddToCartInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  /** Индекс подпрограммы в program.subPrograms[]. Если задан — в корзину добавляется подпрограмма (стоимость = стоимость программы). */
  @Field(() => Int, { nullable: true })
  subProgramIndex?: number;

  @Field(() => Int)
  quantity: number;
}

@InputType()
export class UpdateCartItemInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  @Field(() => Int, { nullable: true })
  subProgramIndex?: number;

  @Field(() => Int)
  quantity: number;
}

@InputType()
export class RemoveFromCartInput {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  @Field(() => Int, { nullable: true })
  subProgramIndex?: number;
}
