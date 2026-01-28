import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Model, Types } from 'mongoose';

import type { UserDocument } from './user.schema';
import type { RefreshTokenDocument } from './refresh-token.schema';
import { sha256 } from 'src/common/utils/crypto.utils';

export async function validateRefreshToken(params: {
  jwtService: JwtService;
  refreshTokenModel: Model<RefreshTokenDocument>;
  userModel: Model<UserDocument>;
  token: string;
}): Promise<{ user: UserDocument; familyId?: string }> {
  const { jwtService, refreshTokenModel, userModel, token } = params;

  try {
    const payload: {
      email: string;
      sub: string;
      role: string;
      type?: string;
    } = await jwtService.verifyAsync(token);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = sha256(token);

    const refreshTokenDoc = await refreshTokenModel
      .findOne({ tokenHash })
      .select('user expiresAt familyId')
      .lean<{
        user: Types.ObjectId;
        expiresAt: Date;
        familyId?: string;
      }>();

    if (!refreshTokenDoc) {
      throw new UnauthorizedException(
        'Refresh token not found or already used',
      );
    }

    if (refreshTokenDoc.expiresAt < new Date()) {
      await refreshTokenModel.deleteOne({ tokenHash });
      throw new UnauthorizedException('Refresh token expired');
    }

    if (refreshTokenDoc.user.toString() !== payload.sub) {
      throw new UnauthorizedException('Refresh token does not belong to user');
    }

    // rotation: удаляем использованный токен
    await refreshTokenModel.deleteOne({ tokenHash });

    const user = await userModel.findOne({ email: payload.email });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    return { user, familyId: refreshTokenDoc.familyId };
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new UnauthorizedException('Invalid refresh token');
  }
}

export async function revokeRefreshToken(params: {
  refreshTokenModel: Model<RefreshTokenDocument>;
  token: string;
}): Promise<void> {
  const { refreshTokenModel, token } = params;
  const tokenHash = sha256(token);
  await refreshTokenModel.deleteOne({ tokenHash });
}

export async function revokeTokenFamily(params: {
  refreshTokenModel: Model<RefreshTokenDocument>;
  familyId: string;
}): Promise<void> {
  const { refreshTokenModel, familyId } = params;
  await refreshTokenModel.deleteMany({ familyId });
}

export async function revokeAllUserTokens(params: {
  refreshTokenModel: Model<RefreshTokenDocument>;
  userId: string;
}): Promise<void> {
  const { refreshTokenModel, userId } = params;
  await refreshTokenModel.deleteMany({ user: userId });
}
