import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Connection, Model, Types } from 'mongoose';

import type { UserDocument } from './user.schema';
import { UserRole } from './user.schema';
import type {
  PendingRegistration,
  PendingRegistrationDocument,
} from './pending-registration.schema';
import type {
  RegisterInput,
  RequestEmailVerificationInput,
  VerifyEmailInput,
} from './user.input';

import type { EmailService } from './email.service';
import type { UserProfileService } from './user-profile.service';
import { UserValidators } from 'src/common/validators/user.validators';
import { sha256 } from 'src/common/utils/crypto.utils';
import { allowEmailSend } from './auth.rate-limit';
import type { CacheService } from 'src/cache/cache.service';

type PendingRegistrationLean = PendingRegistration & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

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

  if (!input.confirmPassword || input.password !== input.confirmPassword) {
    throw new BadRequestException('Passwords do not match');
  }

  const email = UserValidators.normalizeEmail(input.email);

  const allowed = await allowEmailSend(cacheService, 'register', email, ip);
  if (!allowed) return;

  const existingUser = await userModel.findOne({ email }).select('_id').lean();
  if (existingUser) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);

  const passwordHash = await bcrypt.hash(
    UserValidators.normalizePassword(input.password),
    10,
  );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await pendingRegistrationModel.updateOne(
    { email },
    {
      $set: {
        passwordHash,
        firstName:
          typeof input.firstName === 'string' ? input.firstName : undefined,
        lastName:
          typeof input.lastName === 'string' ? input.lastName : undefined,
        phone: UserValidators.normalizeOptionalPhone(input.phone),
        tokenHash,
        expiresAt,
      },
    },
    { upsert: true },
  );

  const frontUrl =
    configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
  const verifyUrl = `${frontUrl}/verify-email#token=${token}`;

  await emailService.sendVerifyEmail(email, verifyUrl);
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

  const existingUser = await userModel.findOne({ email }).select('_id').lean();
  if (existingUser) return;

  const pending = await pendingRegistrationModel
    .findOne({ email })
    .select('_id')
    .lean();
  if (!pending) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await pendingRegistrationModel.updateOne(
    { _id: pending._id },
    { $set: { tokenHash, expiresAt } },
  );

  const frontUrl =
    configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
  const verifyUrl = `${frontUrl}/verify-email#token=${token}`;

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

  const token = typeof input.token === 'string' ? input.token : '';
  if (token.length < 10) {
    throw new BadRequestException('Invalid token');
  }

  const tokenHash = sha256(token);

  const pending = await pendingRegistrationModel
    .findOne({ tokenHash })
    .lean<PendingRegistrationLean>();

  if (!pending) {
    throw new BadRequestException('Token expired or invalid');
  }

  if (pending.expiresAt < new Date()) {
    await pendingRegistrationModel.deleteOne({ _id: pending._id });
    throw new BadRequestException('Token expired or invalid');
  }

  // Проверяем существующего пользователя (до транзакции)
  const existingUser = await userModel.findOne({ email: pending.email });
  if (existingUser) {
    await pendingRegistrationModel.deleteOne({ _id: pending._id });
    if (!existingUser.isEmailVerified) {
      await userModel.updateOne(
        { _id: existingUser._id },
        { $set: { isEmailVerified: true } },
      );
    }
    return existingUser;
  }

  const session = await connection.startSession();
  session.startTransaction();

  try {
    const created = await userModel.create(
      [
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
      ],
      { session },
    );

    const createdUser = created[0];

    await userProfileService.upsertProfile(
      createdUser._id.toString(),
      {
        firstName: pending.firstName,
        lastName: pending.lastName,
        phone: pending.phone,
      },
      session,
    );

    await pendingRegistrationModel.deleteOne({ _id: pending._id }, { session });

    await session.commitTransaction();
    return createdUser;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
