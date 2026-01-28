import crypto from 'crypto';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Model } from 'mongoose';

import type { UserDocument } from '../schemas/user.schema';
import type { RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { sha256 } from 'src/common/utils/crypto.utils';
import { parseExpiresInToDate, signJwt } from './auth.jwt-utils';

export async function createRefreshToken(params: {
  jwtService: JwtService;
  configService: ConfigService;
  refreshTokenModel: Model<RefreshTokenDocument>;
  user: UserDocument;
  existingFamilyId?: string;
}): Promise<{ refreshToken: string; familyId: string }> {
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

  const refreshToken = signJwt(jwtService, payload, refreshExpiresIn);

  const tokenHash = sha256(refreshToken);
  const expiresAt = parseExpiresInToDate(refreshExpiresIn);

  const familyId = existingFamilyId || crypto.randomBytes(16).toString('hex');

  await refreshTokenModel.create({
    user: user._id,
    tokenHash,
    expiresAt,
    familyId,
  });

  return { refreshToken, familyId };
}
