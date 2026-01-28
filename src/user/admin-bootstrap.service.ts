import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, type UserDocument, UserRole } from './user.schema';
import { UserProfileService } from './user-profile.service';
import { UserValidators } from 'src/common/validators/user.validators';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async onModuleInit(): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) return;

    const normalizedAdminEmail = UserValidators.normalizeEmail(adminEmail);

    const existingAdmin = await this.userModel
      .findOne({ email: normalizedAdminEmail, role: UserRole.ADMIN })
      .select('_id')
      .lean();

    if (existingAdmin) return;

    const admin = await this.userModel.create({
      email: normalizedAdminEmail,
      password: adminPassword,
      role: UserRole.ADMIN,
      isBlocked: false,
      isEmailVerified: true,
    });

    await this.userProfileService.upsertProfile(admin.id);
  }
}
