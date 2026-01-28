import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, type UserDocument } from './user.schema';
import { UserValidators } from 'src/common/validators/user.validators';
import { UserAuthService } from './user-auth.service';
import { UserProfileService } from './user-profile.service';
import { UserAdminService } from './user-admin.service';
import {
  RegisterInput,
  RequestEmailVerificationInput,
  UpdateMyProfileInput,
  VerifyEmailInput,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUserFilterInput,
} from './user.input';
import { UserProfileDocument } from './user-profile.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly userAuthService: UserAuthService,
    private readonly userProfileService: UserProfileService,
    private readonly userAdminService: UserAdminService,
  ) {}

  assertNotBlocked(user: UserDocument): void {
    if (user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }
  }

  // ==================== АУТЕНТИФИКАЦИЯ ====================
  async createPendingRegistration(
    input: RegisterInput,
    ip?: string,
  ): Promise<void> {
    return this.userAuthService.createPendingRegistration(input, ip);
  }

  async requestEmailVerification(
    input: RequestEmailVerificationInput,
    ip?: string,
  ): Promise<void> {
    return this.userAuthService.requestEmailVerification(input, ip);
  }

  async verifyEmail(input: VerifyEmailInput): Promise<UserDocument> {
    return this.userAuthService.verifyEmail(input);
  }

  async generateTokens(
    user: UserDocument,
    existingFamilyId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.userAuthService.generateTokens(user, existingFamilyId);
  }

  async validateRefreshToken(
    token: string,
  ): Promise<{ user: UserDocument; familyId?: string }> {
    return this.userAuthService.validateRefreshToken(token);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    return this.userAuthService.revokeRefreshToken(token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    return this.userAuthService.revokeAllUserTokens(userId);
  }

  // ==================== ПРОФИЛЬ ====================
  async upsertProfile(
    userId: string,
    input?: UpdateMyProfileInput,
  ): Promise<UserProfileDocument> {
    return this.userProfileService.upsertProfile(userId, input);
  }

  async getProfileByUserId(
    userId: string,
  ): Promise<UserProfileDocument | null> {
    return this.userProfileService.getProfileByUserId(userId);
  }

  // ==================== АДМИНСКИЕ ОПЕРАЦИИ ====================
  async adminCreate(input: AdminCreateUserInput): Promise<UserDocument> {
    return this.userAdminService.adminCreate(input);
  }

  async adminUpdate(
    userId: string,
    input: AdminUpdateUserInput,
  ): Promise<UserDocument> {
    return this.userAdminService.adminUpdate(userId, input);
  }

  async adminDelete(userId: string): Promise<boolean> {
    return this.userAdminService.adminDelete(userId);
  }

  async adminSetBlocked(
    userId: string,
    blocked: boolean,
  ): Promise<UserDocument> {
    return this.userAdminService.adminSetBlocked(userId, blocked);
  }

  async findAllUsers(filter?: AdminUserFilterInput): Promise<UserDocument[]> {
    return this.userAdminService.findAllUsers(filter);
  }

  // ==================== БАЗОВЫЕ ОПЕРАЦИИ ====================
  async findByEmail(email: string): Promise<UserDocument> {
    const normalized = UserValidators.normalizeEmail(email);
    const user = await this.userModel.findOne({ email: normalized });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
