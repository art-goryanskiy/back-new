import { BadRequestException } from '@nestjs/common';
import type { UpdateMyProfileInput } from '../gql/user.input';
import { cleanUndefined } from 'src/common/utils/object.utils';

export function normalizePassport(input: UpdateMyProfileInput): {
  passport?: Record<string, unknown>;
} {
  let normalizedDepartmentCode: string | undefined;

  if (input.passport) {
    const seriesRaw =
      typeof input.passport.series === 'string'
        ? input.passport.series.replace(/\s/g, '')
        : '';
    if (seriesRaw && !/^\d{4}$/.test(seriesRaw)) {
      throw new BadRequestException(
        'Invalid passport series (expected 4 digits)',
      );
    }

    const numberRaw =
      typeof input.passport.number === 'string'
        ? input.passport.number.replace(/\s/g, '')
        : '';
    if (numberRaw && !/^\d{6}$/.test(numberRaw)) {
      throw new BadRequestException(
        'Invalid passport number (expected 6 digits)',
      );
    }

    if (input.passport.departmentCode) {
      const depRaw =
        typeof input.passport.departmentCode === 'string'
          ? input.passport.departmentCode.replace(/\s/g, '')
          : '';

      if (depRaw) {
        if (/^\d{6}$/.test(depRaw)) {
          normalizedDepartmentCode = `${depRaw.slice(0, 3)}-${depRaw.slice(3)}`;
        } else if (/^\d{3}-\d{3}$/.test(depRaw)) {
          normalizedDepartmentCode = depRaw;
        } else {
          throw new BadRequestException(
            'Invalid department code (expected format: 900-003)',
          );
        }
      }
    }
  }

  const passport =
    input.passport === undefined
      ? undefined
      : input.passport === null
        ? undefined
        : cleanUndefined({
            series:
              typeof input.passport.series === 'string'
                ? input.passport.series.trim()
                : undefined,
            number:
              typeof input.passport.number === 'string'
                ? input.passport.number.trim()
                : undefined,
            issuedBy:
              typeof input.passport.issuedBy === 'string'
                ? input.passport.issuedBy.trim()
                : undefined,
            issuedAt: input.passport.issuedAt,
            departmentCode: normalizedDepartmentCode,
          });

  return { passport };
}
