import type { ClientSession, Model, Types } from 'mongoose';

import type { UserDocument } from '../schemas/user.schema';
import type {
  PendingRegistration,
  PendingRegistrationDocument,
} from '../schemas/pending-registration.schema';

export type PendingRegistrationLean = PendingRegistration & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function userExistsByEmail(
  userModel: Model<UserDocument>,
  email: string,
): Promise<boolean> {
  const existing = await userModel.findOne({ email }).select('_id').lean();
  return Boolean(existing);
}

export async function findExistingUserByEmail(
  userModel: Model<UserDocument>,
  email: string,
): Promise<UserDocument | null> {
  return userModel.findOne({ email });
}

export async function markUserEmailVerified(
  userModel: Model<UserDocument>,
  userId: Types.ObjectId,
): Promise<void> {
  await userModel.updateOne(
    { _id: userId },
    { $set: { isEmailVerified: true } },
  );
}

export async function upsertPendingByEmail(
  pendingRegistrationModel: Model<PendingRegistrationDocument>,
  email: string,
  update: {
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    tokenHash: string;
    expiresAt: Date;
  },
): Promise<void> {
  await pendingRegistrationModel.updateOne(
    { email },
    { $set: update },
    { upsert: true },
  );
}

export async function findPendingIdByEmail(
  pendingRegistrationModel: Model<PendingRegistrationDocument>,
  email: string,
): Promise<Types.ObjectId | null> {
  const pending = await pendingRegistrationModel
    .findOne({ email })
    .select('_id')
    .lean<{ _id: Types.ObjectId }>();

  return pending?._id ?? null;
}

export async function updatePendingTokenById(
  pendingRegistrationModel: Model<PendingRegistrationDocument>,
  id: Types.ObjectId,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await pendingRegistrationModel.updateOne(
    { _id: id },
    { $set: { tokenHash, expiresAt } },
  );
}

export async function findPendingByTokenHash(
  pendingRegistrationModel: Model<PendingRegistrationDocument>,
  tokenHash: string,
): Promise<PendingRegistrationLean | null> {
  return pendingRegistrationModel
    .findOne({ tokenHash })
    .lean<PendingRegistrationLean>();
}

export async function deletePendingById(
  pendingRegistrationModel: Model<PendingRegistrationDocument>,
  id: Types.ObjectId,
  session?: ClientSession,
): Promise<void> {
  await pendingRegistrationModel.deleteOne(
    { _id: id },
    session ? { session } : undefined,
  );
}

export async function createUserInSession(
  userModel: Model<UserDocument>,
  doc: {
    email: string;
    password: string;
    role: string;
    isBlocked: boolean;
    isEmailVerified: boolean;
    firstName?: string;
    lastName?: string;
    phone?: string;
  },
  session: ClientSession,
): Promise<UserDocument> {
  const created = await userModel.create([doc], { session });
  return created[0];
}
