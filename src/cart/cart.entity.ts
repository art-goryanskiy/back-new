import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { ProgramEntity } from 'src/programs/program.entity';

@ObjectType()
export class CartItemEntity {
  @Field(() => ID)
  programId: string;

  @Field(() => Int)
  pricingIndex: number;

  @Field(() => Int, { nullable: true })
  subProgramIndex?: number;

  @Field(() => String, { nullable: true })
  subProgramTitle?: string;

  /** Дополненное наименование для отображения (по типу категории). */
  @Field(() => String)
  displayTitle: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => ProgramEntity)
  program: ProgramEntity;

  @Field(() => Float)
  lineAmount: number;
}

@ObjectType()
export class CartEntity {
  @Field(() => [CartItemEntity])
  items: CartItemEntity[];

  @Field(() => Float)
  totalAmount: number;
}
