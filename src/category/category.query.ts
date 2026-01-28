import { Types, type QueryFilter } from 'mongoose';
import type { CategoryDocument } from './category.schema';

type LimitSkippableQuery<Q> = {
  limit(n: number): Q;
  skip(n: number): Q;
};

export function buildCategoryQuery(params: {
  search: string;
  parent?: string;
  parentIsSet: boolean;
}): QueryFilter<CategoryDocument> {
  const query: QueryFilter<CategoryDocument> = {};

  if (params.search) {
    query.name = { $regex: params.search, $options: 'i' };
  }

  if (params.parentIsSet) {
    if (params.parent) query.parent = new Types.ObjectId(params.parent);
    else query.parent = null;
  }

  return query;
}

export function applyPagination<Q extends LimitSkippableQuery<Q>>(
  mongooseQuery: Q,
  limit?: number,
  offset?: number,
): Q {
  let q = mongooseQuery;
  if (limit) q = q.limit(limit);
  if (offset) q = q.skip(offset);
  return q;
}
