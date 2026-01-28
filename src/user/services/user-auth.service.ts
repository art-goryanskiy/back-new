import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { UserDocument } from '../schemas/user.schema';
import { User } from '../schemas/user.schema';
import type { RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { RefreshToken } from '../schemas/refresh-token.schema';
import type { PendingRegistrationDocument } from '../schemas/pending-registration.schema';
import { PendingRegistration } from '../schemas/pending-registration.schema';
import type { PasswordResetDocument } from '../schemas/password-reset.schema';
import { PasswordReset } from '../schemas/password-reset.schema';

import type {
  RegisterInput,
  RequestEmailVerificationInput,
  VerifyEmailInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  ChangeMyPasswordInput,
} from '../gql/user.input';

import { EmailService } from './email.service';
import { CacheService } from 'src/cache/cache.service';
import { UserProfileService } from './user-profile.service';

import {
  createPendingRegistration,
  requestEmailVerification,
  verifyEmail,
} from '../auth/auth.pending-registration';
import { generateTokens } from '../auth/auth.tokens';
import {
  validateRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  revokeTokenFamily,
} from '../auth/auth.refresh-tokens';
import {
  requestPasswordReset,
  resetPassword,
  changeMyPassword,
} from '../auth/auth.password-reset';

import type {
  PendingRegistrationDeps,
  RefreshTokensDeps,
  TokensDeps,
  UserAuthDeps,
  VerifyEmailDeps,
} from './user-auth.deps';

@Injectable()
export class UserAuthService {
  private readonly deps: UserAuthDeps;

  private readonly pendingDeps: PendingRegistrationDeps;
  private readonly verifyEmailDeps: VerifyEmailDeps;
  private readonly tokensDeps: TokensDeps;
  private readonly refreshTokensDeps: RefreshTokensDeps;

  constructor(
    @InjectModel(User.name)
    userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(PendingRegistration.name)
    pendingRegistrationModel: Model<PendingRegistrationDocument>,
    @InjectModel(PasswordReset.name)
    passwordResetModel: Model<PasswordResetDocument>,
    @InjectConnection()
    connection: Connection,
    jwtService: JwtService,
    configService: ConfigService,
    emailService: EmailService,
    cacheService: CacheService,
    userProfileService: UserProfileService,
  ) {
    this.deps = {
      userModel,
      refreshTokenModel,
      pendingRegistrationModel,
      passwordResetModel,
      connection,
      jwtService,
      configService,
      emailService,
      cacheService,
      userProfileService,
    };

    this.pendingDeps = {
      userModel,
      pendingRegistrationModel,
      emailService,
      configService,
      cacheService,
    };

    this.verifyEmailDeps = {
      userModel,
      pendingRegistrationModel,
      userProfileService,
      connection,
    };

    this.tokensDeps = {
      jwtService,
      configService,
      refreshTokenModel,
    };

    this.refreshTokensDeps = {
      jwtService,
      refreshTokenModel,
      userModel,
    };
  }

  async createPendingRegistration(
    input: RegisterInput,
    ip?: string,
  ): Promise<void> {
    return createPendingRegistration({
      ...this.pendingDeps,
      input,
      ip,
    });
  }

  async requestEmailVerification(
    input: RequestEmailVerificationInput,
    ip?: string,
  ): Promise<void> {
    return requestEmailVerification({
      ...this.pendingDeps,
      input,
      ip,
    });
  }

  async verifyEmail(input: VerifyEmailInput): Promise<UserDocument> {
    return verifyEmail({
      ...this.verifyEmailDeps,
      input,
    });
  }

  async generateTokens(
    user: UserDocument,
    existingFamilyId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return generateTokens({
      ...this.tokensDeps,
      user,
      existingFamilyId,
    });
  }

  async validateRefreshToken(
    token: string,
  ): Promise<{ user: UserDocument; familyId?: string }> {
    return validateRefreshToken({
      ...this.refreshTokensDeps,
      token,
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    return revokeRefreshToken({
      refreshTokenModel: this.deps.refreshTokenModel,
      token,
    });
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    return revokeTokenFamily({
      refreshTokenModel: this.deps.refreshTokenModel,
      familyId,
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    return revokeAllUserTokens({
      refreshTokenModel: this.deps.refreshTokenModel,
      userId,
    });
  }

  // -------- password reset / change password --------

  async requestPasswordReset(
    input: RequestPasswordResetInput,
    ip?: string,
  ): Promise<void> {
    return requestPasswordReset({
      email: input.email,
      ip,
      userModel: this.deps.userModel,
      passwordResetModel: this.deps.passwordResetModel,
      emailService: this.deps.emailService,
      configService: this.deps.configService,
      cacheService: this.deps.cacheService,
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    return resetPassword({
      token: input.token,
      password: input.password,
      confirmPassword: input.confirmPassword,
      userModel: this.deps.userModel,
      refreshTokenModel: this.deps.refreshTokenModel,
      passwordResetModel: this.deps.passwordResetModel,
    });
  }

  async changeMyPassword(
    userId: string,
    input: ChangeMyPasswordInput,
  ): Promise<void> {
    return changeMyPassword({
      userId,
      currentPassword: input.currentPassword,
      password: input.password,
      confirmPassword: input.confirmPassword,
      userModel: this.deps.userModel,
      refreshTokenModel: this.deps.refreshTokenModel,
    });
  }
}
