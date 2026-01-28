import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model } from 'mongoose';
import crypto from 'crypto';

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
import { EmailService } from './email.service';

import { buildAdminUsersQuery } from '../admin/user-admin.query';
import { normalizeAdminUsersPagination } from '../admin/user-admin.validation';
import { UserAdminRepo } from '../admin/user-admin.repo';

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url');
}

@Injectable()
export class UserAdminService {
  private readonly repo: UserAdminRepo;

  constructor(
    @InjectModel(User.name)
    userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly userProfileService: UserProfileService,
    private readonly emailService: EmailService,
  ) {
    this.repo = new UserAdminRepo(userModel, refreshTokenModel);
  }

  async adminCreate(input: AdminCreateUserInput): Promise<UserDocument> {
    const email = UserValidators.normalizeEmail(input.email);

    if (await this.repo.existsByEmail(email)) {
      throw new ConflictException('User with this email already exists');
    }

    const shouldGenerateTemp =
      input.generateTempPassword === true || !input.password;

    const plainPassword = shouldGenerateTemp
      ? generateTempPassword()
      : input.password;

    if (!plainPassword) {
      throw new BadRequestException('password is required');
    }

    try {
      const user = await this.repo.createUser({
        email,
        password: UserValidators.normalizePassword(plainPassword),
        role: input.role ?? UserRole.USER,
        isBlocked: input.isBlocked ?? false,
        isEmailVerified: true,
        mustChangePassword: shouldGenerateTemp,
        firstName: input.profile?.firstName,
        lastName: input.profile?.lastName,
        phone: UserValidators.normalizeOptionalPhone(input.profile?.phone),
      });

      await this.userProfileService.upsertProfile(user.id, input.profile);

      if (shouldGenerateTemp) {
        await this.emailService.sendTempPasswordEmail(email, plainPassword);
      }

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
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (input.email !== undefined) {
      const email = UserValidators.normalizeEmail(input.email);
      if (email !== user.email) {
        if (await this.repo.existsByEmailExceptUser(email, userId)) {
          throw new ConflictException('User with this email already exists');
        }
        user.email = email;
      }
    }

    if (input.password !== undefined) {
      user.password = UserValidators.normalizePassword(input.password);
      user.mustChangePassword = false;
      await this.repo.deleteAllRefreshTokens(userId);
    }

    if (input.isBlocked !== undefined) {
      user.isBlocked = input.isBlocked;
      if (input.isBlocked) {
        await this.repo.deleteAllRefreshTokens(userId);
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
    await this.repo.deleteAllRefreshTokens(userId);
    await this.userProfileService.deleteProfile(userId);
    return this.repo.deleteUser(userId);
  }

  async adminSetBlocked(
    userId: string,
    blocked: boolean,
  ): Promise<UserDocument> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.isBlocked = blocked;
    await user.save();

    if (blocked) {
      await this.repo.deleteAllRefreshTokens(userId);
    }

    return user;
  }

  async findAllUsers(filter?: AdminUserFilterInput): Promise<UserDocument[]> {
    const query = buildAdminUsersQuery(filter);
    const { offset, limit } = normalizeAdminUsersPagination(filter);
    return this.repo.findAll(query, offset, limit);
  }
}
