import { BadRequestException } from '@nestjs/common';
import type { AdminUserFilterInput } from '../gql/user.input';

export function normalizeAdminUsersPagination(filter?: AdminUserFilterInput): {
  offset: number;
  limit: number;
} {
  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? 50;

  if (offset < 0) throw new BadRequestException('offset must be >= 0');
  if (limit < 1) throw new BadRequestException('limit must be >= 1');
  if (limit > 200) throw new BadRequestException('limit must be <= 200');

  return { offset, limit };
}

export function normalizeSearch(
  filter?: AdminUserFilterInput,
): string | undefined {
  const s = filter?.search?.trim();
  return s ? s : undefined;
}
