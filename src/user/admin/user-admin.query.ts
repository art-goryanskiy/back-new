import type { QueryFilter } from 'mongoose';
import type { UserDocument } from '../schemas/user.schema';
import type { AdminUserFilterInput } from '../gql/user.input';
import { normalizeSearch } from './user-admin.validation';

function shouldUseRegexSearch(s: string): boolean {
  // кириллица/ё → regex (Mongo text search для русского часто даёт неожиданные результаты)
  return /[А-Яа-яЁё]/.test(s);
}

export function buildAdminUsersQuery(
  filter?: AdminUserFilterInput,
): QueryFilter<UserDocument> {
  const query: QueryFilter<UserDocument> = {};

  if (filter?.isBlocked !== undefined) {
    query.isBlocked = filter.isBlocked;
  }

  const s = normalizeSearch(filter);
  if (!s) return query;

  if (shouldUseRegexSearch(s)) {
    query.$or = [
      { email: { $regex: s, $options: 'i' } },
      { firstName: { $regex: s, $options: 'i' } },
      { lastName: { $regex: s, $options: 'i' } },
      { phone: { $regex: s, $options: 'i' } },
    ];
    return query;
  }

  query.$text = { $search: s };
  return query;
}
