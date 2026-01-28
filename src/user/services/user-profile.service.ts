import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import type { UserDocument } from '../schemas/user.schema';
import { User } from '../schemas/user.schema';
import type { UserProfileDocument } from '../schemas/user-profile.schema';
import { UserProfile } from '../schemas/user-profile.schema';
import type { UpdateMyProfileInput } from '../gql/user.input';

import { FileCleanupService } from 'src/common/services/file-cleanup.service';
import { UserProfileRepo } from '../profile/user-profile.repo';
import {
  validateDateOfBirth,
  buildProfileUpdate,
  buildUserSyncUpdate,
  normalizeAvatar,
} from '../profile/user-profile.validation';

@Injectable()
export class UserProfileService {
  private readonly repo: UserProfileRepo;

  constructor(
    @InjectModel(User.name)
    userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name)
    userProfileModel: Model<UserProfileDocument>,
    private readonly fileCleanupService: FileCleanupService,
  ) {
    this.repo = new UserProfileRepo(userModel, userProfileModel);
  }

  async upsertProfile(
    userId: string,
    input?: UpdateMyProfileInput,
    session?: ClientSession,
  ): Promise<UserProfileDocument> {
    if (!input) {
      return this.repo.ensureExists(userId, session);
    }

    validateDateOfBirth(input);

    const newAvatar = normalizeAvatar(input);
    if (newAvatar) {
      const existingProfile = await this.repo.findProfileAvatarLean(userId);
      if (existingProfile?.avatar && existingProfile.avatar !== newAvatar) {
        await this.fileCleanupService.safeDeleteFile(
          existingProfile.avatar,
          'user avatar',
        );
      }
    }

    const profileUpdate = buildProfileUpdate(input);
    const userUpdate = buildUserSyncUpdate(input);

    // sync user fields in same transaction (if provided)
    await this.repo.syncUserFields(userId, userUpdate, session);

    // upsert profile and return it safely (works with session/transactions)
    return this.repo.upsertAndReturnByUserId(userId, profileUpdate, session);
  }

  async getProfileByUserId(
    userId: string,
  ): Promise<UserProfileDocument | null> {
    return this.repo.findProfile(userId);
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.repo.deleteProfile(userId);
  }
}
