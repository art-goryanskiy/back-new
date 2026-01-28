import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import type { UpdateMyProfileInput } from '../gql/user.input';
import { UserValidators } from 'src/common/validators/user.validators';
import { cleanUndefined } from 'src/common/utils/object.utils';

import { normalizeAvatar } from './user-profile.avatar';
import { normalizePassport } from './user-profile.passport';

export function validateDateOfBirth(input: UpdateMyProfileInput): void {
  if (input.dateOfBirth && input.dateOfBirth > new Date()) {
    throw new BadRequestException('dateOfBirth cannot be in the future');
  }
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
