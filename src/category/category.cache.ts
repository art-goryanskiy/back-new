import type { Types } from 'mongoose';
import type { CacheService } from 'src/cache/cache.service';
import { sha256 } from 'src/common/utils/crypto.utils';
import type { Category, CategoryDocument } from './category.schema';

export type CategoryPlain = Category & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  parent?: Types.ObjectId | string;
};

export function buildCategoryFilterCacheKey(
  payload: Record<string, unknown>,
): string {
  return `category:filter:${sha256(JSON.stringify(payload))}`;
}

export async function getCategoryFilterCached(
  cacheService: CacheService,
  categoryModel: { hydrate: (obj: unknown) => CategoryDocument },
  cacheKey: string,
): Promise<CategoryDocument[] | null> {
  const cached = await cacheService.get<CategoryPlain[]>(cacheKey);
  if (!cached) return null;
  return cached.map((item) => categoryModel.hydrate(item));
}

export async function setCategoryFilterCache(
  cacheService: CacheService,
  cacheKey: string,
  docs: CategoryDocument[],
  ttlSeconds: number,
): Promise<void> {
  await cacheService.set(
    cacheKey,
    docs.map((d) => d.toObject()),
    ttlSeconds,
  );
}

export async function invalidateCategoryFilters(
  cacheService: CacheService,
): Promise<void> {
  await cacheService.delByPattern('category:filter:*');
}
