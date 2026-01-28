import type { JwtService, JwtSignOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';

/**
 * Typed wrapper around JwtService.sign to avoid @ts-expect-error noise.
 */
export function signJwt(
  jwtService: JwtService,
  payload: Record<string, unknown>,
  expiresIn: string,
): string {
  const options: JwtSignOptions = {
    expiresIn: expiresIn as unknown as StringValue,
  };

  return jwtService.sign(payload, options);
}

/**
 * "15m", "7d", "2h", "30s" -> Date (relative to now)
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
