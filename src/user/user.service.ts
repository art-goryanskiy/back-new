import { BadRequestException, Injectable } from '@nestjs/common';

import type { UserDocument } from './schemas/user.schema';
import type { UserProfileDocument } from './schemas/user-profile.schema';
import { MAX_WORK_PLACES } from './schemas/user-profile.schema';

import { UserAuthService } from './services/user-auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserAdminService } from './services/user-admin.service';
import { UserCoreService } from './services/user-core.service';

import {
  RegisterInput,
  RequestEmailVerificationInput,
  UpdateMyProfileInput,
  VerifyEmailInput,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUserFilterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  ChangeMyPasswordInput,
} from './gql/user.input';

@Injectable()
export class UserService {
  constructor(
    private readonly userCoreService: UserCoreService,
    private readonly userAuthService: UserAuthService,
    private readonly userProfileService: UserProfileService,
    private readonly userAdminService: UserAdminService,
  ) {}

  // ==================== core ====================
  assertNotBlocked(user: UserDocument): void {
    return this.userCoreService.assertNotBlocked(user);
  }

  async findByEmail(email: string): Promise<UserDocument> {
    return this.userCoreService.findByEmail(email);
  }

  async findById(id: string): Promise<UserDocument> {
    return this.userCoreService.findById(id);
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return this.userCoreService.validatePassword(password, hashedPassword);
  }

  // ==================== auth ====================
  async createPendingRegistration(
    input: RegisterInput,
    ip?: string,
  ): Promise<void> {
    return this.userAuthService.createPendingRegistration(input, ip);
  }

  async requestEmailVerification(
    input: RequestEmailVerificationInput,
    ip?: string,
  ): Promise<void> {
    return this.userAuthService.requestEmailVerification(input, ip);
  }

  async verifyEmail(input: VerifyEmailInput): Promise<UserDocument> {
    return this.userAuthService.verifyEmail(input);
  }

  async generateTokens(
    user: UserDocument,
    existingFamilyId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.userAuthService.generateTokens(user, existingFamilyId);
  }

  async validateRefreshToken(
    token: string,
  ): Promise<{ user: UserDocument; familyId?: string }> {
    return this.userAuthService.validateRefreshToken(token);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    return this.userAuthService.revokeRefreshToken(token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    return this.userAuthService.revokeAllUserTokens(userId);
  }

  async requestPasswordReset(
    input: RequestPasswordResetInput,
    ip?: string,
  ): Promise<void> {
    return this.userAuthService.requestPasswordReset(input, ip);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    return this.userAuthService.resetPassword(input);
  }

  async changeMyPassword(
    userId: string,
    input: ChangeMyPasswordInput,
  ): Promise<void> {
    return this.userAuthService.changeMyPassword(userId, input);
  }

  // ==================== profile ====================
  async upsertProfile(
    userId: string,
    input?: UpdateMyProfileInput,
  ): Promise<UserProfileDocument> {
    return this.userProfileService.upsertProfile(userId, input);
  }

  async getProfileByUserId(
    userId: string,
  ): Promise<UserProfileDocument | null> {
    return this.userProfileService.getProfileByUserId(userId);
  }

  /**
   * Добавить организацию в места работы пользователя, если её ещё нет.
   * Лимит 5 мест; ровно одна запись с isPrimary.
   */
  async ensureWorkPlace(userId: string, organizationId: string): Promise<void> {
    const profile = await this.userProfileService.getProfileByUserId(userId);
    const current = profile?.workPlaces ?? [];
    const ids = current
      .map((w) => w.organization?.toString())
      .filter((id): id is string => Boolean(id));
    if (ids.includes(organizationId)) return;

    if (current.length >= MAX_WORK_PLACES) {
      throw new BadRequestException(
        `Достигнут лимит мест работы: не более ${MAX_WORK_PLACES}`,
      );
    }

    const workPlaces: NonNullable<UpdateMyProfileInput['workPlaces']> = [
      ...current.map((e) => ({
        organizationId: e.organization.toString(),
        position: e.position,
        isPrimary: e.isPrimary,
      })),
      { organizationId, isPrimary: current.length === 0 },
    ];
    if (!workPlaces.some((e) => e.isPrimary)) {
      workPlaces[workPlaces.length - 1] = {
        ...workPlaces[workPlaces.length - 1],
        isPrimary: true,
      };
    }
    await this.userProfileService.upsertProfile(userId, { workPlaces });
  }

  // ==================== admin ====================
  async adminCreate(input: AdminCreateUserInput): Promise<UserDocument> {
    return this.userAdminService.adminCreate(input);
  }

  async adminUpdate(
    userId: string,
    input: AdminUpdateUserInput,
  ): Promise<UserDocument> {
    return this.userAdminService.adminUpdate(userId, input);
  }

  async adminDelete(userId: string): Promise<boolean> {
    return this.userAdminService.adminDelete(userId);
  }

  async adminSetBlocked(
    userId: string,
    blocked: boolean,
  ): Promise<UserDocument> {
    return this.userAdminService.adminSetBlocked(userId, blocked);
  }

  async findAllUsers(filter?: AdminUserFilterInput): Promise<UserDocument[]> {
    return this.userAdminService.findAllUsers(filter);
  }
}
