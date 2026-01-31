import { ProgramDocument } from 'src/programs/program.schema';
import {
  ProgramEntity,
  ProgramPricing,
  ProgramSubProgramEntity,
} from 'src/programs/program.entity';
import { extractId } from './base.mapper';

export function toProgramEntity(
  program: ProgramDocument | null,
): ProgramEntity | null {
  if (!program) return null;

  const programObj = program.toObject();
  const programWithTimestamps = programObj as typeof programObj & {
    createdAt?: Date;
    updatedAt?: Date;
  };

  const pricing: ProgramPricing[] = Array.isArray(program.pricing)
    ? program.pricing.map((item) => ({
        hours: item.hours,
        price: item.price,
      }))
    : [];

  const subPrograms: ProgramSubProgramEntity[] = Array.isArray(
    program.subPrograms,
  )
    ? program.subPrograms.map((sp) => ({
        title: sp.title,
        description: sp.description,
      }))
    : [];

  return {
    id: extractId(program),
    title: program.title,
    shortTitle: program.shortTitle,
    slug: program.slug,
    description: program.description,
    category: program.category.toString(),
    educationDocumentId: program.educationDocument?.toString(),
    studentCategory: program.studentCategory,
    awardedQualification: program.awardedQualification,
    awardedRankFrom: program.awardedRankFrom,
    awardedRankTo: program.awardedRankTo,
    baseHours: program.baseHours,
    pricing,
    image: program.image,
    views: program.views || 0,
    subPrograms,
    createdAt: programWithTimestamps.createdAt || new Date(),
    updatedAt: programWithTimestamps.updatedAt || new Date(),
  };
}

export function toProgramEntityArray(
  programs: ProgramDocument[],
): ProgramEntity[] {
  return programs
    .map(toProgramEntity)
    .filter((p): p is ProgramEntity => p !== null);
}
