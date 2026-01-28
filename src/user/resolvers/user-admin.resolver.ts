import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';

import { UserEntity } from '../gql/user.entity';
import { UserService } from '../user.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { UserRole } from '../schemas/user.schema';
import {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUserFilterInput,
} from '../gql/user.input';
import {
  toUserEntity,
  toUserEntityArray,
} from 'src/common/mappers/user.mapper';

@Resolver(() => UserEntity)
export class UserAdminResolver {
  constructor(private readonly userService: UserService) {}

  private assertAdmin(user: CurrentUserPayload) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

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
