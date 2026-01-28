import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserAuthService } from './services/user-auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserAdminService } from './services/user-admin.service';
import { User, UserSchema } from './schemas/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserAuthResolver } from './resolvers/user-auth.resolver';
import { UserProfileResolver } from './resolvers/user-profile.resolver';
import { UserAdminResolver } from './resolvers/user-admin.resolver';
import { JwtStrategy } from './strategy/jwt.strategy';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { StorageModule } from 'src/storage/storage.module';
import { CacheModule } from 'src/cache/cache.module';
import {
  PendingRegistration,
  PendingRegistrationSchema,
} from './schemas/pending-registration.schema';
import {
  PasswordReset,
  PasswordResetSchema,
} from './schemas/password-reset.schema';
import { EmailService } from './services/email.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { CookieService } from './services/cookie.service';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';
import { AdminBootstrapService } from './services/admin-bootstrap.service';
import { UserCoreService } from './services/user-core.service';

@Module({
  providers: [
    UserProfileService,
    UserCoreService,
    AdminBootstrapService,
    UserService,
    UserAuthService,
    UserAdminService,
    UserAuthResolver,
    UserProfileResolver,
    UserAdminResolver,
    JwtStrategy,
    EmailService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    CookieService,
    FileCleanupService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    MongooseModule.forFeature([
      { name: PendingRegistration.name, schema: PendingRegistrationSchema },
    ]),
    MongooseModule.forFeature([
      { name: PasswordReset.name, schema: PasswordResetSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is not set');
        return {
          secret,
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRES_IN') || '7d',
          },
        };
      },
      inject: [ConfigService],
    }),
    StorageModule,
    CacheModule,
  ],
  exports: [
    UserService,
    UserAuthService,
    UserProfileService,
    UserAdminService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    JwtModule,
    CookieService,
  ],
})
export class UserModule {}
