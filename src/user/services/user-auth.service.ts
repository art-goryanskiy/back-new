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

import type {
  RegisterInput,
  RequestEmailVerificationInput,
  VerifyEmailInput,
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

@Injectable()
export class UserAuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(PendingRegistration.name)
    private pendingRegistrationModel: Model<PendingRegistrationDocument>,
    @InjectConnection()
    private connection: Connection,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private cacheService: CacheService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async createPendingRegistration(
    input: RegisterInput,
    ip?: string,
  ): Promise<void> {
    return createPendingRegistration({
      input,
      ip,
      userModel: this.userModel,
      pendingRegistrationModel: this.pendingRegistrationModel,
      emailService: this.emailService,
      configService: this.configService,
      cacheService: this.cacheService,
    });
  }

  async requestEmailVerification(
    input: RequestEmailVerificationInput,
    ip?: string,
  ): Promise<void> {
    return requestEmailVerification({
      input,
      ip,
      userModel: this.userModel,
      pendingRegistrationModel: this.pendingRegistrationModel,
      emailService: this.emailService,
      configService: this.configService,
      cacheService: this.cacheService,
    });
  }

  async verifyEmail(input: VerifyEmailInput): Promise<UserDocument> {
    return verifyEmail({
      input,
      userModel: this.userModel,
      pendingRegistrationModel: this.pendingRegistrationModel,
      userProfileService: this.userProfileService,
      connection: this.connection,
    });
  }

  async generateTokens(
    user: UserDocument,
    existingFamilyId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return generateTokens({
      jwtService: this.jwtService,
      configService: this.configService,
      refreshTokenModel: this.refreshTokenModel,
      user,
      existingFamilyId,
    });
  }

  async validateRefreshToken(
    token: string,
  ): Promise<{ user: UserDocument; familyId?: string }> {
    return validateRefreshToken({
      jwtService: this.jwtService,
      refreshTokenModel: this.refreshTokenModel,
      userModel: this.userModel,
      token,
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    return revokeRefreshToken({
      refreshTokenModel: this.refreshTokenModel,
      token,
    });
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    return revokeTokenFamily({
      refreshTokenModel: this.refreshTokenModel,
      familyId,
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    return revokeAllUserTokens({
      refreshTokenModel: this.refreshTokenModel,
      userId,
    });
  }
}
