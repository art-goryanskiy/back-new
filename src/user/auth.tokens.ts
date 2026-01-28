import crypto from 'crypto';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Model } from 'mongoose';

import type { UserDocument } from './user.schema';
import type { RefreshTokenDocument } from './refresh-token.schema';
import { sha256 } from 'src/common/utils/crypto.utils';

export function generateAccessToken(
  jwtService: JwtService,
  configService: ConfigService,
  user: UserDocument,
): string {
  const payload = {
    email: user.email,
    sub: user.id,
    role: user.role,
    type: 'access',
  };

  // @ts-expect-error - expiresIn accepts string values like "15m", "7d"
  return jwtService.sign(payload, {
    expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
  });
}

/**
 * "15m", "7d", "2h" -> Date (относительно сейчас)
 */
export function parseExpiresInToDate(expiresIn: string): Date {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const date = new Date();

  switch (unit) {
    case 's':
      date.setSeconds(date.getSeconds() + value);
      break;
    case 'm':
      date.setMinutes(date.getMinutes() + value);
      break;
    case 'h':
      date.setHours(date.getHours() + value);
      break;
    case 'd':
      date.setDate(date.getDate() + value);
      break;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }

  return date;
}

export async function generateRefreshToken(params: {
  jwtService: JwtService;
  configService: ConfigService;
  refreshTokenModel: Model<RefreshTokenDocument>;
  user: UserDocument;
  existingFamilyId?: string;
}): Promise<string> {
  const {
    jwtService,
    configService,
    refreshTokenModel,
    user,
    existingFamilyId,
  } = params;

  const payload = {
    email: user.email,
    sub: user.id,
    role: user.role,
    type: 'refresh',
  };

  const refreshExpiresIn =
    configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

  // @ts-expect-error - expiresIn accepts string values like "15m", "7d"
  const refreshToken = jwtService.sign(payload, {
    expiresIn: refreshExpiresIn,
  });

  const tokenHash = sha256(refreshToken);
  const expiresAt = parseExpiresInToDate(refreshExpiresIn);

  const familyId = existingFamilyId || crypto.randomBytes(16).toString('hex');

  await refreshTokenModel.create({
    user: user._id,
    tokenHash,
    expiresAt,
    familyId,
  });

  return refreshToken;
}

export async function generateTokens(params: {
  jwtService: JwtService;
  configService: ConfigService;
  refreshTokenModel: Model<RefreshTokenDocument>;
  user: UserDocument;
  existingFamilyId?: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const {
    jwtService,
    configService,
    refreshTokenModel,
    user,
    existingFamilyId,
  } = params;

  const accessToken = generateAccessToken(jwtService, configService, user);
  const refreshToken = await generateRefreshToken({
    jwtService,
    configService,
    refreshTokenModel,
    user,
    existingFamilyId,
  });

  return { accessToken, refreshToken };
}
