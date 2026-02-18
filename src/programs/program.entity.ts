import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { EducationDocumentEntity } from 'src/education-document/education-document.entity';

@ObjectType()
export class ProgramPricing {
  @Field(() => Number)
  hours: number;

  @Field(() => Number, { nullable: true })
  price?: number;
}

@ObjectType()
export class ProgramSubProgramEntity {
  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@ObjectType()
export class ProgramEntity {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  shortTitle?: string;

  @Field(() => String)
  slug: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID)
  category: string;

  @Field(() => ID, { nullable: true })
  educationDocumentId?: string;

  @Field(() => EducationDocumentEntity, { nullable: true })
  educationDocument?: EducationDocumentEntity;

  @Field(() => String, { nullable: true })
  studentCategory?: string;

  @Field(() => String, { nullable: true })
  awardedQualification?: string;

  @Field(() => Number, {
    nullable: true,
    description: 'Разряд с (или единственный разряд)',
  })
  awardedRankFrom?: number;

  @Field(() => Number, {
    nullable: true,
    description: 'Разряд по (или единственный разряд)',
  })
  awardedRankTo?: number;

  @Field(() => Number, { nullable: true })
  baseHours?: number;

  @Field(() => [ProgramPricing])
  pricing: ProgramPricing[];

  @Field(() => String, { nullable: true })
  image?: string;

  @Field(() => Number)
  views: number;

  /** Рейтинг популярности 0–5 на основе просмотров (вычисляемое поле) */
  @Field(() => Number, {
    description: 'Рейтинг популярности 0–5 на основе количества просмотров',
  })
  viewsRating: number;

  @Field(() => [ProgramSubProgramEntity], { nullable: true })
  subPrograms?: ProgramSubProgramEntity[];

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class ProgramsPageEntity {
  @Field(() => [ProgramEntity])
  items: ProgramEntity[];

  @Field(() => Int)
  total: number;
}
