import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

/**
 * Парсит строку типа "15m", "7d", "2h" в миллисекунды
 */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Устанавливает access token cookie с правильным maxAge из конфига
   */
  setAccessTokenCookie(res: Response, token: string): void {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const maxAge = parseDurationToMs(expiresIn);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
    });
  }

  /**
   * Устанавливает refresh token cookie с правильным maxAge из конфига
   */
  setRefreshTokenCookie(res: Response, token: string): void {
    const expiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const maxAge = parseDurationToMs(expiresIn);

    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
    });
  }

  /**
   * Устанавливает оба токена
   */
  setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);
  }

  /**
   * Очищает оба токена
   */
  clearTokenCookies(res: Response): void {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
}
