import type { Types } from 'mongoose';
import type { CacheService } from 'src/cache/cache.service';
import { sha256 } from 'src/common/utils/crypto.utils';
import type {
  Program,
  ProgramDocument,
  ProgramPricing,
  ProgramSubProgram,
} from './program.schema';

export type ProgramPlain = Program & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  shortTitle?: string;
  category: Types.ObjectId | string;
  pricing?: ProgramPricing[];
  subPrograms?: ProgramSubProgram[];
};

export function buildProgramsFilterCacheKey(
  payload: Record<string, unknown>,
): string {
  return `program:filter:${sha256(JSON.stringify(payload))}`;
}

export async function getProgramsFilterCached(
  cacheService: CacheService,
  programModel: { hydrate: (obj: unknown) => ProgramDocument },
  cacheKey: string,
): Promise<ProgramDocument[] | null> {
  const cached = await cacheService.get<ProgramPlain[]>(cacheKey);
  if (!cached) return null;
  return cached.map((item) => programModel.hydrate(item));
}

export async function setProgramsFilterCache(
  cacheService: CacheService,
  cacheKey: string,
  docs: ProgramDocument[],
  ttlSeconds: number,
): Promise<void> {
  await cacheService.set(
    cacheKey,
    docs.map((d) => d.toObject()),
    ttlSeconds,
  );
}

export async function invalidateProgramsFilters(
  cacheService: CacheService,
): Promise<void> {
  await cacheService.delByPattern('program:filter:*');
}
