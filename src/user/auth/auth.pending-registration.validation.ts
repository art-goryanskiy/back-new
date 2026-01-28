import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { RegisterInput, VerifyEmailInput } from '../gql/user.input';
import { UserValidators } from 'src/common/validators/user.validators';
import { sha256 } from 'src/common/utils/crypto.utils';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function assertPasswordsMatch(input: RegisterInput): void {
  if (!input.confirmPassword || input.password !== input.confirmPassword) {
    throw new BadRequestException('Passwords do not match');
  }
}

export async function buildPendingDraft(input: RegisterInput): Promise<{
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}> {
  const email = UserValidators.normalizeEmail(input.email);

  const passwordHash = await bcrypt.hash(
    UserValidators.normalizePassword(input.password),
    10,
  );

  return {
    email,
    passwordHash,
    firstName:
      typeof input.firstName === 'string' ? input.firstName : undefined,
    lastName: typeof input.lastName === 'string' ? input.lastName : undefined,
    phone: UserValidators.normalizeOptionalPhone(input.phone),
  };
}

export function createEmailVerificationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: sha256(token) };
}

export function computeExpiresAt(ttlMs: number = ONE_DAY_MS): Date {
  return new Date(Date.now() + ttlMs);
}

export function buildVerifyEmailUrl(
  configService: ConfigService,
  token: string,
): string {
  const frontUrl =
    configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
  return `${frontUrl}/verify-email#token=${token}`;
}

export function extractAndValidateToken(input: VerifyEmailInput): string {
  const token = typeof input.token === 'string' ? input.token : '';
  if (token.length < 10) {
    throw new BadRequestException('Invalid token');
  }
  return token;
}

export function hashToken(token: string): string {
  return sha256(token);
}

export function assertNotExpired(expiresAt: Date): void {
  if (expiresAt < new Date()) {
    throw new BadRequestException('Token expired or invalid');
  }
}
