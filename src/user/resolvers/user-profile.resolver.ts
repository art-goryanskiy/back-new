import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { UserEntity, UserProfileEntity } from '../gql/user.entity';
import { UserService } from '../user.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { UpdateMyProfileInput } from '../gql/user.input';
import {
  toUserEntity,
  toUserProfileEntity,
} from 'src/common/mappers/user.mapper';

@Resolver(() => UserEntity)
export class UserProfileResolver {
  constructor(private readonly userService: UserService) {}

  @ResolveField(() => UserProfileEntity, { nullable: true })
  async profile(@Parent() user: UserEntity): Promise<UserProfileEntity | null> {
    const withProfile = user as UserEntity & {
      profile?: UserProfileEntity | null;
    };
    if (withProfile.profile != null) return withProfile.profile;
    const profile = await this.userService.getProfileByUserId(user.id);
    return toUserProfileEntity(profile);
  }

  @Query(() => UserEntity)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: CurrentUserPayload): Promise<UserEntity> {
    const userData = await this.userService.findByEmail(user.email);
    this.userService.assertNotBlocked(userData);
    const entity = toUserEntity(userData) as UserEntity;
    const profile = await this.userService.getProfileByUserId(
      userData._id.toString(),
    );
    return { ...entity, profile: toUserProfileEntity(profile) ?? undefined };
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
}
