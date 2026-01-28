import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserAuthService } from './user-auth.service';
import { UserProfileService } from './user-profile.service';
import { UserAdminService } from './user-admin.service';
import { User, UserSchema } from './user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserResolver } from './user.resolver';
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.schema';
import { UserProfile, UserProfileSchema } from './user-profile.schema';
import { StorageModule } from 'src/storage/storage.module';
import { CacheModule } from 'src/cache/cache.module';
import {
  PendingRegistration,
  PendingRegistrationSchema,
} from './pending-registration.schema';
import { EmailService } from './email.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { CookieService } from './cookie.service';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  providers: [
    UserProfileService,
    AdminBootstrapService,
    UserService,
    UserAuthService,
    UserAdminService,
    UserResolver,
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
