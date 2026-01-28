import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Connection, Model } from 'mongoose';

import type { UserDocument } from '../schemas/user.schema';
import { UserRole } from '../schemas/user.schema';
import type { PendingRegistrationDocument } from '../schemas/pending-registration.schema';
import type {
  RegisterInput,
  RequestEmailVerificationInput,
  VerifyEmailInput,
} from '../gql/user.input';

import type { EmailService } from '../services/email.service';
import type { UserProfileService } from '../services/user-profile.service';
import type { CacheService } from 'src/cache/cache.service';

import { UserValidators } from 'src/common/validators/user.validators';
import { allowEmailSend } from './auth.rate-limit';
import {
  assertPasswordsMatch,
  buildPendingDraft,
  buildVerifyEmailUrl,
  computeExpiresAt,
  createEmailVerificationToken,
  extractAndValidateToken,
  hashToken,
} from './auth.pending-registration.validation';
import {
  createUserInSession,
  deletePendingById,
  findExistingUserByEmail,
  findPendingByTokenHash,
  findPendingIdByEmail,
  markUserEmailVerified,
  updatePendingTokenById,
  upsertPendingByEmail,
  userExistsByEmail,
} from './auth.pending-registration.repo';

export async function createPendingRegistration(params: {
  input: RegisterInput;
  ip?: string;
  userModel: Model<UserDocument>;
  pendingRegistrationModel: Model<PendingRegistrationDocument>;
  emailService: EmailService;
  configService: ConfigService;
  cacheService: CacheService;
}): Promise<void> {
  const {
    input,
    ip,
    userModel,
    pendingRegistrationModel,
    emailService,
    configService,
    cacheService,
  } = params;

  assertPasswordsMatch(input);

  const draft = await buildPendingDraft(input);

  const allowed = await allowEmailSend(
    cacheService,
    'register',
    draft.email,
    ip,
  );
  if (!allowed) return;

  const exists = await userExistsByEmail(userModel, draft.email);
  if (exists) return;

  const { token, tokenHash } = createEmailVerificationToken();
  const expiresAt = computeExpiresAt();

  await upsertPendingByEmail(pendingRegistrationModel, draft.email, {
    passwordHash: draft.passwordHash,
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone,
    tokenHash,
    expiresAt,
  });

  const verifyUrl = buildVerifyEmailUrl(configService, token);
  await emailService.sendVerifyEmail(draft.email, verifyUrl);
}

export async function requestEmailVerification(params: {
  input: RequestEmailVerificationInput;
  ip?: string;
  userModel: Model<UserDocument>;
  pendingRegistrationModel: Model<PendingRegistrationDocument>;
  emailService: EmailService;
  configService: ConfigService;
  cacheService: CacheService;
}): Promise<void> {
  const {
    input,
    ip,
    userModel,
    pendingRegistrationModel,
    emailService,
    configService,
    cacheService,
  } = params;

  const email = UserValidators.normalizeEmail(input.email);

  const allowed = await allowEmailSend(cacheService, 'resend', email, ip);
  if (!allowed) return;

  const exists = await userExistsByEmail(userModel, email);
  if (exists) return;

  const pendingId = await findPendingIdByEmail(pendingRegistrationModel, email);
  if (!pendingId) return;

  const { token, tokenHash } = createEmailVerificationToken();
  const expiresAt = computeExpiresAt();

  await updatePendingTokenById(
    pendingRegistrationModel,
    pendingId,
    tokenHash,
    expiresAt,
  );

  const verifyUrl = buildVerifyEmailUrl(configService, token);
  await emailService.sendVerifyEmail(email, verifyUrl);
}

export async function verifyEmail(params: {
  input: VerifyEmailInput;
  userModel: Model<UserDocument>;
  pendingRegistrationModel: Model<PendingRegistrationDocument>;
  userProfileService: UserProfileService;
  connection: Connection;
}): Promise<UserDocument> {
  const {
    input,
    userModel,
    pendingRegistrationModel,
    userProfileService,
    connection,
  } = params;

  const token = extractAndValidateToken(input);
  const tokenHash = hashToken(token);

  const pending = await findPendingByTokenHash(
    pendingRegistrationModel,
    tokenHash,
  );
  if (!pending) {
    throw new BadRequestException('Token expired or invalid');
  }

  if (pending.expiresAt < new Date()) {
    await deletePendingById(pendingRegistrationModel, pending._id);
    throw new BadRequestException('Token expired or invalid');
  }

  const existingUser = await findExistingUserByEmail(userModel, pending.email);
  if (existingUser) {
    await deletePendingById(pendingRegistrationModel, pending._id);

    if (!existingUser.isEmailVerified) {
      await markUserEmailVerified(userModel, existingUser._id);
      existingUser.isEmailVerified = true;
    }

    return existingUser;
  }

  const session = await connection.startSession();
  session.startTransaction();

  try {
    const createdUser = await createUserInSession(
      userModel,
      {
        email: pending.email,
        password: pending.passwordHash,
        role: UserRole.USER,
        isBlocked: false,
        isEmailVerified: true,
        firstName: pending.firstName,
        lastName: pending.lastName,
        phone: pending.phone,
      },
      session,
    );

    await userProfileService.upsertProfile(
      createdUser._id.toString(),
      {
        firstName: pending.firstName,
        lastName: pending.lastName,
        phone: pending.phone,
      },
      session,
    );

    await deletePendingById(pendingRegistrationModel, pending._id, session);

    await session.commitTransaction();
    return createdUser;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
