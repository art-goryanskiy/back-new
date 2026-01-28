import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserDocument, UserRole } from '../schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';
import {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUserFilterInput,
} from '../gql/user.input';

import { UserValidators } from 'src/common/validators/user.validators';
import { isMongoDuplicateKeyError } from 'src/common/utils/mongo.utils';
import { UserProfileService } from './user-profile.service';

import { buildAdminUsersQuery } from '../admin/user-admin.query';
import { normalizeAdminUsersPagination } from '../admin/user-admin.validation';

@Injectable()
export class UserAdminService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    private userProfileService: UserProfileService,
  ) {}

  async adminCreate(input: AdminCreateUserInput): Promise<UserDocument> {
    const email = UserValidators.normalizeEmail(input.email);

    const existingUser = await this.userModel
      .findOne({ email })
      .select('_id')
      .lean();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      const user = await this.userModel.create({
        email,
        password: UserValidators.normalizePassword(input.password),
        role: input.role ?? UserRole.USER,
        isBlocked: input.isBlocked ?? false,
        isEmailVerified: true,
        firstName: input.profile?.firstName,
        lastName: input.profile?.lastName,
        phone: UserValidators.normalizeOptionalPhone(input.profile?.phone),
      });

      await this.userProfileService.upsertProfile(user.id, input.profile);

      return user;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  async adminUpdate(
    userId: string,
    input: AdminUpdateUserInput,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (input.email !== undefined) {
      const email = UserValidators.normalizeEmail(input.email);
      if (email !== user.email) {
        const exists = await this.userModel
          .findOne({
            email,
            _id: { $ne: new Types.ObjectId(userId) },
          })
          .select('_id')
          .lean();

        if (exists) {
          throw new ConflictException('User with this email already exists');
        }

        user.email = email;
      }
    }

    if (input.password !== undefined) {
      user.password = UserValidators.normalizePassword(input.password);
    }

    if (input.isBlocked !== undefined) {
      user.isBlocked = input.isBlocked;

      if (input.isBlocked) {
        await this.refreshTokenModel.deleteMany({ user: user._id });
      }
    }

    try {
      await user.save();
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }

    if (input.profile !== undefined) {
      await this.userProfileService.upsertProfile(user.id, input.profile);
    }

    return user;
  }

  async adminDelete(userId: string): Promise<boolean> {
    await this.refreshTokenModel.deleteMany({
      user: new Types.ObjectId(userId),
    });
    await this.userProfileService.deleteProfile(userId);

    const res = await this.userModel.deleteOne({
      _id: new Types.ObjectId(userId),
    });
    return res.deletedCount === 1;
  }

  async adminSetBlocked(
    userId: string,
    blocked: boolean,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.isBlocked = blocked;
    await user.save();

    if (blocked) {
      await this.refreshTokenModel.deleteMany({
        user: new Types.ObjectId(userId),
      });
    }

    return user;
  }

  async findAllUsers(filter?: AdminUserFilterInput): Promise<UserDocument[]> {
    const query = buildAdminUsersQuery(filter);
    const { offset, limit } = normalizeAdminUsersPagination(filter);

    return this.userModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }
}
