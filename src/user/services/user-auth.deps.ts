import type { Connection, Model } from 'mongoose';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';

import type { UserDocument } from '../schemas/user.schema';
import type { RefreshTokenDocument } from '../schemas/refresh-token.schema';
import type { PendingRegistrationDocument } from '../schemas/pending-registration.schema';
import type { PasswordResetDocument } from '../schemas/password-reset.schema';

import type { EmailService } from './email.service';
import type { CacheService } from 'src/cache/cache.service';
import type { UserProfileService } from './user-profile.service';

export type UserAuthDeps = {
  userModel: Model<UserDocument>;
  refreshTokenModel: Model<RefreshTokenDocument>;
  pendingRegistrationModel: Model<PendingRegistrationDocument>;
  passwordResetModel: Model<PasswordResetDocument>;
  connection: Connection;

  jwtService: JwtService;
  configService: ConfigService;

  emailService: EmailService;
  cacheService: CacheService;

  userProfileService: UserProfileService;
};

export type PendingRegistrationDeps = Pick<
  UserAuthDeps,
  | 'userModel'
  | 'pendingRegistrationModel'
  | 'emailService'
  | 'configService'
  | 'cacheService'
>;

export type VerifyEmailDeps = Pick<
  UserAuthDeps,
  'userModel' | 'pendingRegistrationModel' | 'userProfileService' | 'connection'
>;

export type TokensDeps = Pick<
  UserAuthDeps,
  'jwtService' | 'configService' | 'refreshTokenModel'
>;

export type RefreshTokensDeps = Pick<
  UserAuthDeps,
  'jwtService' | 'refreshTokenModel' | 'userModel'
>;
