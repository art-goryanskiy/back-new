import { Field, ID, InputType, registerEnumType } from '@nestjs/graphql';

export enum BulkPatchMode {
  REPLACE = 'REPLACE',
  DELTA = 'DELTA',
  CLEAR = 'CLEAR',
}

registerEnumType(BulkPatchMode, { name: 'BulkPatchMode' });

@InputType()
export class ProgramPricingInput {
  @Field(() => Number)
  hours: number;

  @Field(() => Number)
  price: number;
}

@InputType()
export class ProgramSubProgramInput {
  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
export class CreateProgramInput {
  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  shortTitle?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID)
  category: string;

  @Field(() => ID, { nullable: true })
  educationDocumentId?: string;

  @Field(() => String, { nullable: true })
  image?: string;

  @Field(() => String, { nullable: true })
  studentCategory?: string;

  @Field(() => String, { nullable: true })
  awardedQualification?: string;

  @Field(() => Number, {
    nullable: true,
    description: 'Разряд с (или единственный разряд); необязательно',
  })
  awardedRankFrom?: number;

  @Field(() => Number, {
    nullable: true,
    description: 'Разряд по (или единственный разряд); необязательно',
  })
  awardedRankTo?: number;

  @Field(() => Number, { nullable: true })
  baseHours?: number;

  @Field(() => [ProgramPricingInput], { nullable: true, defaultValue: [] })
  pricing?: ProgramPricingInput[];

  @Field(() => [ProgramSubProgramInput], { nullable: true, defaultValue: [] })
  subPrograms?: ProgramSubProgramInput[];
}

@InputType()
export class UpdateProgramInput {
  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  shortTitle?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  category?: string;

  @Field(() => ID, { nullable: true })
  educationDocumentId?: string;

  @Field(() => String, { nullable: true })
  image?: string;

  @Field(() => String, { nullable: true })
  studentCategory?: string;

  @Field(() => String, { nullable: true })
  awardedQualification?: string;

  @Field(() => Number, {
    nullable: true,
    description: 'Разряд с (или единственный разряд); необязательно',
  })
  awardedRankFrom?: number;

  @Field(() => Number, {
    nullable: true,
    description: 'Разряд по (или единственный разряд); необязательно',
  })
  awardedRankTo?: number;

  @Field(() => Number, { nullable: true })
  baseHours?: number | null;

  @Field(() => [ProgramPricingInput], { nullable: true })
  pricing?: ProgramPricingInput[];

  @Field(() => [ProgramSubProgramInput], { nullable: true })
  subPrograms?: ProgramSubProgramInput[];
}

@InputType()
export class UpdateProgramsBulkPatchInput {
  @Field(() => ID, { nullable: true })
  category?: string;

  @Field(() => [ProgramPricingInput], { nullable: true })
  pricing?: ProgramPricingInput[];

  @Field(() => Number, { nullable: true })
  baseHours?: number;

  @Field(() => BulkPatchMode)
  mode: BulkPatchMode;
}

@InputType()
export class UpdateProgramsBulkInput {
  @Field(() => [ID])
  ids: string[];

  @Field(() => UpdateProgramsBulkPatchInput)
  patch: UpdateProgramsBulkPatchInput;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  dryRun?: boolean;
}

@InputType()
export class ProgramFilterInput {
  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => [ID], { nullable: true })
  categoryIds?: string[];

  @Field(() => Number, { nullable: true })
  limit?: number;

  @Field(() => Number, { nullable: true })
  offset?: number;

  @Field(() => String, { nullable: true })
  sortBy?: string;

  @Field(() => String, { nullable: true })
  sortOrder?: string;
}
