import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';

import { sha256 } from 'src/common/utils/crypto.utils';
import { UserValidators } from 'src/common/validators/user.validators';

import type { UserDocument } from '../schemas/user.schema';
import type { RefreshTokenDocument } from '../schemas/refresh-token.schema';
import type { PasswordResetDocument } from '../schemas/password-reset.schema';
import type { EmailService } from '../services/email.service';
import type { CacheService } from 'src/cache/cache.service';

import { allowEmailSend } from './auth.rate-limit';

export async function requestPasswordReset(params: {
  email: string;
  ip?: string;
  userModel: Model<UserDocument>;
  passwordResetModel: Model<PasswordResetDocument>;
  emailService: EmailService;
  configService: ConfigService;
  cacheService: CacheService;
}): Promise<void> {
  const {
    email: rawEmail,
    ip,
    userModel,
    passwordResetModel,
    emailService,
    configService,
    cacheService,
  } = params;

  const email = UserValidators.normalizeEmail(rawEmail);

  const allowed = await allowEmailSend(
    cacheService,
    'passwordReset',
    email,
    ip,
  );
  if (!allowed) return;

  const user = await userModel
    .findOne({ email })
    .select('_id isBlocked')
    .lean();
  if (!user || user.isBlocked) return;

  await passwordResetModel.deleteMany({ email });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await passwordResetModel.create({ email, tokenHash, expiresAt });

  const frontUrl =
    configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
  const resetUrl = `${frontUrl}/reset-password#token=${token}`;

  await emailService.sendPasswordResetEmail(email, resetUrl);
}

export async function resetPassword(params: {
  token: string;
  password: string;
  confirmPassword: string;
  userModel: Model<UserDocument>;
  refreshTokenModel: Model<RefreshTokenDocument>;
  passwordResetModel: Model<PasswordResetDocument>;
}): Promise<void> {
  const {
    token,
    password,
    confirmPassword,
    userModel,
    refreshTokenModel,
    passwordResetModel,
  } = params;

  if (!confirmPassword || password !== confirmPassword) {
    throw new BadRequestException('Passwords do not match');
  }
  if (typeof token !== 'string' || token.length < 10) {
    throw new BadRequestException('Invalid token');
  }

  const tokenHash = sha256(token);
  const now = new Date();

  const pr = await passwordResetModel.findOneAndUpdate(
    { tokenHash, usedAt: { $exists: false }, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true },
  );

  if (!pr) throw new BadRequestException('Token expired or invalid');

  const user = await userModel.findOne({ email: pr.email });
  if (!user) throw new BadRequestException('Token expired or invalid');

  user.password = UserValidators.normalizePassword(password);
  user.mustChangePassword = false;
  await user.save();

  await refreshTokenModel.deleteMany({ user: user._id });
}

export async function changeMyPassword(params: {
  userId: string;
  currentPassword: string;
  password: string;
  confirmPassword: string;
  userModel: Model<UserDocument>;
  refreshTokenModel: Model<RefreshTokenDocument>;
}): Promise<void> {
  const {
    userId,
    currentPassword,
    password,
    confirmPassword,
    userModel,
    refreshTokenModel,
  } = params;

  if (!confirmPassword || password !== confirmPassword) {
    throw new BadRequestException('Passwords do not match');
  }

  const user = await userModel.findById(userId);
  if (!user) throw new UnauthorizedException('Invalid user');

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new UnauthorizedException('Invalid current password');

  user.password = UserValidators.normalizePassword(password);
  user.mustChangePassword = false;
  await user.save();

  await refreshTokenModel.deleteMany({ user: user._id });
}
