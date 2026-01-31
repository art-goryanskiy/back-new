import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import type { UpdateMyProfileInput } from '../gql/user.input';
import { UserValidators } from 'src/common/validators/user.validators';
import { cleanUndefined } from 'src/common/utils/object.utils';
import { MAX_WORK_PLACES } from '../schemas/user-profile.schema';

import { normalizeAvatar } from './user-profile.avatar';
import { normalizePassport } from './user-profile.passport';

export function validateDateOfBirth(input: UpdateMyProfileInput): void {
  if (input.dateOfBirth && input.dateOfBirth > new Date()) {
    throw new BadRequestException('dateOfBirth cannot be in the future');
  }
}

export function validateWorkPlaces(input: UpdateMyProfileInput): void {
  const list = input.workPlaces;
  if (!list || !Array.isArray(list) || list.length === 0) return;

  if (list.length > MAX_WORK_PLACES) {
    throw new BadRequestException(
      `workPlaces: не более ${MAX_WORK_PLACES} записей`,
    );
  }

  const primaryCount = list.filter(
    (e) => e && typeof e.isPrimary === 'boolean' && e.isPrimary,
  ).length;
  if (primaryCount !== 1) {
    throw new BadRequestException(
      'workPlaces: ровно одна запись должна иметь isPrimary: true',
    );
  }
}

export function buildProfileUpdate(
  input: UpdateMyProfileInput,
): Record<string, unknown> {
  const { passport } = normalizePassport(input);
  const newAvatar = normalizeAvatar(input);

  const workPlaces =
    input.workPlaces && Array.isArray(input.workPlaces) && input.workPlaces.length > 0
      ? input.workPlaces.map((e) => ({
          organization: new Types.ObjectId(e.organizationId),
          position:
            typeof e.position === 'string' ? e.position.trim() : undefined,
          isPrimary: Boolean(e.isPrimary),
        }))
      : undefined;

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

    workPlaces,

    snils: UserValidators.normalizeOptionalSnils(input.snils),

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
