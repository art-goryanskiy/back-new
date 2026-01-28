import { Types, type Model, type QueryFilter } from 'mongoose';

import type { UserDocument, UserRole } from '../schemas/user.schema';
import type { RefreshTokenDocument } from '../schemas/refresh-token.schema';

export class UserAdminRepo {
  constructor(
    private readonly userModel: Model<UserDocument>,
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  async createUser(doc: {
    email: string;
    password: string;
    role: UserRole;
    isBlocked: boolean;
    isEmailVerified: boolean;
    mustChangePassword: boolean;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<UserDocument> {
    return this.userModel.create(doc);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const existing = await this.userModel
      .findOne({ email })
      .select('_id')
      .lean();
    return Boolean(existing);
  }

  async existsByEmailExceptUser(
    email: string,
    userId: string,
  ): Promise<boolean> {
    const existing = await this.userModel
      .findOne({
        email,
        _id: { $ne: new Types.ObjectId(userId) },
      })
      .select('_id')
      .lean();

    return Boolean(existing);
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  async deleteAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({
      user: new Types.ObjectId(userId),
    });
  }

  async deleteUser(userId: string): Promise<boolean> {
    const res = await this.userModel.deleteOne({
      _id: new Types.ObjectId(userId),
    });
    return res.deletedCount === 1;
  }

  async findAll(
    query: QueryFilter<UserDocument>,
    offset: number,
    limit: number,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }
}
