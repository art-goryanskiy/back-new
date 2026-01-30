export const PROGRAM_SELECT =
  '_id title shortTitle slug description category studentCategory awardedQualification awardedRankFrom awardedRankTo baseHours pricing image views subPrograms createdAt updatedAt' as const;

export type ProgramSortField = 'views' | 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';
