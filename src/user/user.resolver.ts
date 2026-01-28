import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UserEntity, UserProfileEntity } from './user.entity';
import { UserService } from './user.service';
import {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUserFilterInput,
  LoginInput,
  RegisterInput,
  RequestEmailVerificationInput,
  UpdateMyProfileInput,
  VerifyEmailInput,
} from './user.input';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { UserDocument, UserRole } from './user.schema';
import { CookieService } from './cookie.service';
import {
  toUserEntity,
  toUserEntityArray,
  toUserProfileEntity,
} from 'src/common/mappers/user.mapper';
import { BaseResolver } from 'src/common/base/base.resolver';

@Resolver(() => UserEntity)
export class UserResolver extends BaseResolver {
  constructor(
    private readonly userService: UserService,
    private readonly cookieService: CookieService,
  ) {
    super();
  }

  private assertAdmin(user: CurrentUserPayload) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

  private getIp(req: Request): string | undefined {
    const xf = req.headers['x-forwarded-for'];
    const fromHeader =
      typeof xf === 'string' ? xf.split(',')[0]?.trim() : undefined;
    return fromHeader || req.ip;
  }

  @ResolveField(() => UserProfileEntity, { nullable: true })
  async profile(@Parent() user: UserEntity): Promise<UserProfileEntity | null> {
    const profile = await this.userService.getProfileByUserId(user.id);
    return toUserProfileEntity(profile);
  }

  @Mutation(() => UserEntity)
  async login(
    @Args('input') loginInput: LoginInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<UserEntity> {
    let user: UserDocument;

    try {
      user = await this.userService.findByEmail(loginInput.email);
    } catch (e: unknown) {
      // Не раскрываем, существует ли пользователь
      if (e instanceof NotFoundException) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw e;
    }

    const isPasswordValid = await this.userService.validatePassword(
      loginInput.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.userService.assertNotBlocked(user);

    if (user.isEmailVerified === false) {
      throw new ForbiddenException('Email is not verified');
    }

    const { accessToken, refreshToken } =
      await this.userService.generateTokens(user);

    this.cookieService.setTokenCookies(context.res, accessToken, refreshToken);

    return toUserEntity(user) as UserEntity;
  }

  @Mutation(() => UserEntity)
  async refreshToken(
    @Context() context: { req: Request; res: Response },
  ): Promise<UserEntity> {
    const refreshToken = (context.req.cookies as { refreshToken?: string })
      ?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { user, familyId } =
      await this.userService.validateRefreshToken(refreshToken);

    const { accessToken, refreshToken: newRefreshToken } =
      await this.userService.generateTokens(user, familyId);

    this.cookieService.setTokenCookies(
      context.res,
      accessToken,
      newRefreshToken,
    );

    return toUserEntity(user) as UserEntity;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Context() context: { req: Request; res: Response },
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<boolean> {
    const refreshToken = (context.req.cookies as { refreshToken?: string })
      ?.refreshToken;

    if (refreshToken) {
      await this.userService.revokeRefreshToken(refreshToken);
    }

    await this.userService.revokeAllUserTokens(user.id);

    this.cookieService.clearTokenCookies(context.res);

    return true;
  }

  // ---------------- register/verify (NEW CONTRACT) ----------------

  @Mutation(() => Boolean)
  async register(
    @Args('input') registerInput: RegisterInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    await this.userService.createPendingRegistration(
      registerInput,
      this.getIp(context.req),
    );
    return true;
  }

  @Mutation(() => Boolean)
  async verifyEmail(
    @Args('input') input: VerifyEmailInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    const user = await this.userService.verifyEmail(input);
    this.userService.assertNotBlocked(user);

    const { accessToken, refreshToken } =
      await this.userService.generateTokens(user);

    this.cookieService.setTokenCookies(context.res, accessToken, refreshToken);

    return true;
  }

  @Mutation(() => Boolean)
  async requestEmailVerification(
    @Args('input') input: RequestEmailVerificationInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    await this.userService.requestEmailVerification(
      input,
      this.getIp(context.req),
    );
    return true;
  }

  // ---------------- user/profile ----------------

  @Query(() => UserEntity)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: CurrentUserPayload): Promise<UserEntity> {
    const userData = await this.userService.findByEmail(user.email);
    this.userService.assertNotBlocked(userData);
    return toUserEntity(userData) as UserEntity;
  }

  @Mutation(() => UserProfileEntity)
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @Args('input') input: UpdateMyProfileInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserProfileEntity> {
    const userData = await this.userService.findById(user.id);
    this.userService.assertNotBlocked(userData);

    const profile = await this.userService.upsertProfile(user.id, input);
    return toUserProfileEntity(profile) as UserProfileEntity;
  }

  // ---------------- admin CRUD (как было) ----------------

  @Query(() => [UserEntity])
  @UseGuards(JwtAuthGuard)
  async adminUsers(
    @Args('filter', { nullable: true, type: () => AdminUserFilterInput })
    filter: AdminUserFilterInput | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserEntity[]> {
    this.assertAdmin(user);
    const users = await this.userService.findAllUsers(filter);
    return toUserEntityArray(users);
  }

  @Query(() => UserEntity, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async adminUser(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserEntity | null> {
    this.assertAdmin(user);
    const u = await this.userService.findById(id);
    return toUserEntity(u);
  }

  @Mutation(() => UserEntity)
  @UseGuards(JwtAuthGuard)
  async adminCreateUser(
    @Args('input') input: AdminCreateUserInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserEntity> {
    this.assertAdmin(user);
    const created = await this.userService.adminCreate(input);
    return toUserEntity(created) as UserEntity;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async adminDeleteUser(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<boolean> {
    this.assertAdmin(user);
    return this.userService.adminDelete(id);
  }

  @Mutation(() => UserEntity)
  @UseGuards(JwtAuthGuard)
  async adminUpdateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: AdminUpdateUserInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserEntity> {
    this.assertAdmin(user);
    const updated = await this.userService.adminUpdate(id, input);
    return toUserEntity(updated) as UserEntity;
  }

  @Mutation(() => UserEntity)
  @UseGuards(JwtAuthGuard)
  async adminSetUserBlocked(
    @Args('id', { type: () => ID }) id: string,
    @Args('blocked') blocked: boolean,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserEntity> {
    this.assertAdmin(user);
    const updated = await this.userService.adminSetBlocked(id, blocked);
    return toUserEntity(updated) as UserEntity;
  }
}
