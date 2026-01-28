import type { Request } from 'express';

export function getClientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];

  const first =
    typeof xf === 'string'
      ? xf.split(',')[0]?.trim()
      : Array.isArray(xf)
        ? xf[0]?.trim()
        : undefined;

  return first || req.ip;
}

export function getRefreshTokenFromCookies(req: Request): string | undefined {
  const cookies = req.cookies as { refreshToken?: unknown } | undefined;
  const token = cookies?.refreshToken;
  return typeof token === 'string' && token.trim() ? token : undefined;
}
