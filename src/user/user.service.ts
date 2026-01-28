import { Injectable } from '@nestjs/common';

import type { UserDocument } from './schemas/user.schema';
import type { UserProfileDocument } from './schemas/user-profile.schema';

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
