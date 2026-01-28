import type { ClientSession, Model } from 'mongoose';
import { Types } from 'mongoose';
import type { UserDocument } from '../schemas/user.schema';
import type { UserProfileDocument } from '../schemas/user-profile.schema';
import { NotFoundException } from '@nestjs/common';

export class UserProfileRepo {
  constructor(
    private readonly userModel: Model<UserDocument>,
    private readonly userProfileModel: Model<UserProfileDocument>,
  ) {}

  async findProfile(userId: string): Promise<UserProfileDocument | null> {
    return this.userProfileModel.findOne({ user: new Types.ObjectId(userId) });
  }

  async findProfileAvatarLean(
    userId: string,
  ): Promise<{ avatar?: string } | null> {
    return this.userProfileModel
      .findOne({ user: new Types.ObjectId(userId) })
      .select('avatar')
      .lean();
  }

  async upsertProfileByUserId(
    userId: string,
    update: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<void> {
    await this.userProfileModel.updateOne(
      { user: new Types.ObjectId(userId) },
      {
        $setOnInsert: { user: new Types.ObjectId(userId) },
        $set: update,
      },
      { upsert: true, ...(session ? { session } : {}) },
    );
  }

  async upsertAndReturnByUserId(
    userId: string,
    update: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<UserProfileDocument> {
    const oid = new Types.ObjectId(userId);

    const profile = await this.userProfileModel.findOneAndUpdate(
      { user: oid },
      { $setOnInsert: { user: oid }, $set: update },
      { upsert: true, new: true, ...(session ? { session } : {}) },
    );

    // по идее при upsert:true profile всегда будет, но оставим защиту
    if (!profile) throw new NotFoundException('User profile not found');
    return profile;
  }

  async syncUserFields(
    userId: string,
    update: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<void> {
    if (!Object.keys(update).length) return;

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: update },
      session ? { session } : undefined,
    );
  }

  async getProfileOrThrow(userId: string): Promise<UserProfileDocument> {
    const profile = await this.findProfile(userId);
    if (!profile) throw new NotFoundException('User profile not found');
    return profile;
  }

  async ensureExists(
    userId: string,
    session?: ClientSession,
  ): Promise<UserProfileDocument> {
    const existing = await this.findProfile(userId);
    if (existing) return existing;

    const created = await this.userProfileModel.create(
      [{ user: new Types.ObjectId(userId) }],
      session ? { session } : undefined,
    );

    return created[0];
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.userProfileModel.deleteOne({ user: new Types.ObjectId(userId) });
  }
}
