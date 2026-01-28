import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { UserEntity } from '../gql/user.entity';
import { UserService } from '../user.service';
import { CookieService } from '../services/cookie.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import type { UserDocument } from '../schemas/user.schema';
import {
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
  RequestEmailVerificationInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  ChangeMyPasswordInput,
} from '../gql/user.input';
import { toUserEntity } from 'src/common/mappers/user.mapper';
import {
  getClientIp,
  getRefreshTokenFromCookies,
} from './user-auth.resolver.utils';

@Resolver(() => UserEntity)
export class UserAuthResolver {
  constructor(
    private readonly userService: UserService,
    private readonly cookieService: CookieService,
  ) {}

  @Mutation(() => UserEntity)
  async login(
    @Args('input') loginInput: LoginInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<UserEntity> {
    let user: UserDocument;

    try {
      user = await this.userService.findByEmail(loginInput.email);
    } catch (e: unknown) {
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
    const refreshToken = getRefreshTokenFromCookies(context.req);
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
    const refreshToken = getRefreshTokenFromCookies(context.req);

    if (refreshToken) {
      await this.userService.revokeRefreshToken(refreshToken);
    }

    await this.userService.revokeAllUserTokens(user.id);
    this.cookieService.clearTokenCookies(context.res);

    return true;
  }

  @Mutation(() => Boolean)
  async register(
    @Args('input') registerInput: RegisterInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    await this.userService.createPendingRegistration(
      registerInput,
      getClientIp(context.req),
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
      getClientIp(context.req),
    );
    return true;
  }

  // -------- password reset / change password --------

  @Mutation(() => Boolean)
  async requestPasswordReset(
    @Args('input') input: RequestPasswordResetInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    await this.userService.requestPasswordReset(
      input,
      getClientIp(context.req),
    );
    return true;
  }

  @Mutation(() => Boolean)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    await this.userService.resetPassword(input);
    this.cookieService.clearTokenCookies(context.res);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async changeMyPassword(
    @Args('input') input: ChangeMyPasswordInput,
    @CurrentUser() user: CurrentUserPayload,
    @Context() context: { req: Request; res: Response },
  ): Promise<boolean> {
    await this.userService.changeMyPassword(user.id, input);
    this.cookieService.clearTokenCookies(context.res);
    return true;
  }
}
