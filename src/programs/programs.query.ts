import { Types, type QueryFilter } from 'mongoose';
import type { ProgramDocument } from './program.schema';
import type { ProgramSortField, SortOrder } from './programs.select';

type SortablePaginatableQuery<Q> = {
  sort(sort: Record<string, 1 | -1>): Q;
  limit(n: number): Q;
  skip(n: number): Q;
};

export function buildProgramsQuery(params: {
  search: string;
  category?: string;
  categoryIds?: string[];
}): QueryFilter<ProgramDocument> {
  const query: QueryFilter<ProgramDocument> = {};

  if (params.search) query.title = { $regex: params.search, $options: 'i' };

  if (Array.isArray(params.categoryIds) && params.categoryIds.length > 0) {
    query.category = {
      $in: params.categoryIds.map((id) => new Types.ObjectId(id)),
    };
  } else if (params.category) {
    query.category = new Types.ObjectId(params.category);
  }

  return query;
}

export function computeSort(
  requestedSortBy: unknown,
  requestedSortOrder: unknown,
): { sortBy: ProgramSortField; sortOrder: SortOrder } {
  const sortBy = normalizeSortBy(requestedSortBy);
  const sortOrder = requestedSortOrder === 'asc' ? 'asc' : 'desc';

  // дефолт для createdAt всегда desc
  if (sortBy === 'createdAt') return { sortBy, sortOrder: 'desc' };

  return { sortBy, sortOrder };
}

function normalizeSortBy(v: unknown): ProgramSortField {
  if (v === 'views' || v === 'title' || v === 'createdAt') return v;
  return 'createdAt';
}

export function applySort<Q extends SortablePaginatableQuery<Q>>(
  mongooseQuery: Q,
  sortBy: ProgramSortField,
  sortOrder: SortOrder,
): Q {
  const dir: 1 | -1 = sortOrder === 'asc' ? 1 : -1;

  if (sortBy === 'views') return mongooseQuery.sort({ views: dir });
  if (sortBy === 'title') return mongooseQuery.sort({ title: dir });
  return mongooseQuery.sort({ createdAt: -1 });
}

export function applyPagination<Q extends SortablePaginatableQuery<Q>>(
  mongooseQuery: Q,
  limit?: number,
  offset?: number,
): Q {
  let q = mongooseQuery;
  if (limit) q = q.limit(limit);
  if (offset) q = q.skip(offset);
  return q;
}
