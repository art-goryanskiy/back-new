import { UserDocument } from 'src/user/schemas/user.schema';
import { UserProfileDocument } from 'src/user/schemas/user-profile.schema';
import { UserEntity, UserProfileEntity } from 'src/user/gql/user.entity';

/**
 * Преобразует UserDocument в UserEntity
 */
export function toUserEntity(user: UserDocument | null): UserEntity | null {
  if (!user) return null;

  // Используем toObject() для получения plain object с timestamps
  const userObj = user.toObject();
  const userWithTimestamps = userObj as typeof userObj & {
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
    isEmailVerified: user.isEmailVerified,
    mustChangePassword: user.mustChangePassword,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    createdAt: userWithTimestamps.createdAt || new Date(),
    updatedAt: userWithTimestamps.updatedAt || new Date(),
  };
}

/**
 * Преобразует массив UserDocument в массив UserEntity
 */
export function toUserEntityArray(users: UserDocument[]): UserEntity[] {
  return users.map(toUserEntity).filter((u): u is UserEntity => u !== null);
}

/** Собирает массив workPlaces из профиля (новый формат или legacy workPlaceId/position). */
function toWorkPlacesFromProfile(profile: UserProfileDocument): Array<{
  organizationId: string;
  position?: string;
  isPrimary: boolean;
}> {
  if (
    Array.isArray(profile.workPlaces) &&
    profile.workPlaces.length > 0
  ) {
    return profile.workPlaces.map((e) => ({
      organizationId: (e.organization as { toString?: () => string }).toString?.() ?? String(e.organization),
      position: e.position,
      isPrimary: Boolean(e.isPrimary),
    }));
  }
  if (profile.workPlaceId) {
    return [
      {
        organizationId: profile.workPlaceId.toString(),
        position: profile.position,
        isPrimary: true,
      },
    ];
  }
  return [];
}

/**
 * Преобразует UserProfileDocument в UserProfileEntity
 */
export function toUserProfileEntity(
  profile: UserProfileDocument | null,
): UserProfileEntity | null {
  if (!profile) return null;

  const workPlaces = toWorkPlacesFromProfile(profile);

  return {
    lastName: profile.lastName,
    firstName: profile.firstName,
    middleName: profile.middleName,
    dateOfBirth: profile.dateOfBirth,
    citizenship: profile.citizenship,
    phone: profile.phone,
    passport: profile.passport
      ? {
          series: profile.passport.series,
          number: profile.passport.number,
          issuedBy: profile.passport.issuedBy,
          issuedAt: profile.passport.issuedAt,
          departmentCode: profile.passport.departmentCode,
        }
      : undefined,
    passportRegistrationAddress: profile.passportRegistrationAddress,
    residentialAddress: profile.residentialAddress,
    education: profile.education
      ? {
          qualification: profile.education.qualification,
          documentIssuedAt: profile.education.documentIssuedAt,
        }
      : undefined,
    workPlaces: workPlaces as UserProfileEntity['workPlaces'],
    snils: profile.snils,
    avatar: profile.avatar,
  };
}
