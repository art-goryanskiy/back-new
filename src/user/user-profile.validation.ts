import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserValidators } from 'src/common/validators/user.validators';
import { cleanUndefined } from 'src/common/utils/object.utils';
import type { UpdateMyProfileInput } from './user.input';

export function normalizeAvatar(
  input: UpdateMyProfileInput,
): string | undefined {
  const rawAvatar = (input as { avatar?: unknown }).avatar;
  const newAvatar =
    typeof rawAvatar === 'string' ? rawAvatar.trim() : undefined;
  return newAvatar && newAvatar.length ? newAvatar : undefined;
}

export function validateDateOfBirth(input: UpdateMyProfileInput): void {
  if (input.dateOfBirth && input.dateOfBirth > new Date()) {
    throw new BadRequestException('dateOfBirth cannot be in the future');
  }
}

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

export function buildProfileUpdate(
  input: UpdateMyProfileInput,
): Record<string, unknown> {
  const { passport } = normalizePassport(input);
  const newAvatar = normalizeAvatar(input);

  return cleanUndefined({
    lastName:
      typeof input.lastName === 'string' ? input.lastName.trim() : undefined,
    firstName:
      typeof input.firstName === 'string' ? input.firstName.trim() : undefined,
    middleName:
      typeof input.middleName === 'string'
        ? input.middleName.trim()
        : undefined,

    dateOfBirth: input.dateOfBirth,
    citizenship:
      typeof input.citizenship === 'string'
        ? input.citizenship.trim()
        : undefined,

    phone: UserValidators.normalizeOptionalPhone(input.phone),

    passport,

    passportRegistrationAddress:
      typeof input.passportRegistrationAddress === 'string'
        ? input.passportRegistrationAddress.trim()
        : undefined,

    residentialAddress:
      typeof input.residentialAddress === 'string'
        ? input.residentialAddress.trim()
        : undefined,

    education:
      input.education === undefined
        ? undefined
        : input.education === null
          ? undefined
          : cleanUndefined({
              qualification:
                typeof input.education.qualification === 'string'
                  ? input.education.qualification.trim()
                  : undefined,
              documentIssuedAt: input.education.documentIssuedAt,
            }),

    position:
      typeof input.position === 'string' ? input.position.trim() : undefined,

    snils: UserValidators.normalizeOptionalSnils(input.snils),

    workPlaceId: input.workPlaceId
      ? new Types.ObjectId(input.workPlaceId)
      : undefined,

    avatar: newAvatar,
  });
}

export function buildUserSyncUpdate(
  input: UpdateMyProfileInput,
): Record<string, unknown> {
  return cleanUndefined({
    firstName:
      typeof input.firstName === 'string' ? input.firstName.trim() : undefined,
    lastName:
      typeof input.lastName === 'string' ? input.lastName.trim() : undefined,
    phone: UserValidators.normalizeOptionalPhone(input.phone),
  });
}
