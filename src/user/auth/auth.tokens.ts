import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Model } from 'mongoose';

import type { UserDocument } from '../schemas/user.schema';
import type { RefreshTokenDocument } from '../schemas/refresh-token.schema';

import { signJwt } from './auth.jwt-utils';
import { createRefreshToken } from './auth.refresh-token.create';

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

  const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '15m';
  return signJwt(jwtService, payload, expiresIn);
}

export async function generateRefreshToken(params: {
  jwtService: JwtService;
  configService: ConfigService;
  refreshTokenModel: Model<RefreshTokenDocument>;
  user: UserDocument;
  existingFamilyId?: string;
}): Promise<string> {
  const { refreshToken } = await createRefreshToken(params);
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

  const { refreshToken } = await createRefreshToken({
    jwtService,
    configService,
    refreshTokenModel,
    user,
    existingFamilyId,
  });

  return { accessToken, refreshToken };
}
