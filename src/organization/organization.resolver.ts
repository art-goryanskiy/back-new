import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import {
  OrganizationEntity,
  OrganizationSuggestionEntity,
} from './organization.entity';
import {
  OrganizationSuggestionsArgs,
  SetMyWorkPlaceByInnInput,
  SetMyWorkPlaceManualInput,
} from './organization.input';
import { DadataPartyService } from './dadata-party.service';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { UserService } from 'src/user/user.service';
import { toUserProfileEntity } from 'src/common/mappers/user.mapper';
import { UserProfileEntity } from 'src/user/gql/user.entity';
import { getClientIp } from 'src/user/resolvers/user-auth.resolver.utils';
import type { UpdateMyProfileInput } from 'src/user/gql/user.input';

@Resolver(() => OrganizationEntity)
export class OrganizationResolver {
  constructor(
    private readonly dadataPartyService: DadataPartyService,
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  @Query(() => [OrganizationSuggestionEntity])
  async organizationSuggestions(
    @Args() args: OrganizationSuggestionsArgs,
    @Context() context: { req: Request },
  ): Promise<OrganizationSuggestionEntity[]> {
    const limit = typeof args.count === 'number' ? args.count : 10;

    const local = await this.organizationService.searchLocalSuggestions({
      query: args.query,
      limit,
    });

    // If local results are enough, return them without hitting provider
    if (local.length >= Math.min(10, Math.max(1, Math.trunc(limit)))) {
      return local;
    }

    const remote = await this.dadataPartyService.suggest({
      query: args.query,
      count: limit,
      ip: getClientIp(context.req),
    });

    const seen = new Set<string>();
    const out: OrganizationSuggestionEntity[] = [];

    const push = (s: OrganizationSuggestionEntity) => {
      const key = `${s.type}:${s.inn}:${s.kpp ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    };

    for (const s of local) push(s);
    for (const s of remote) push(s);

    return out.slice(0, Math.min(10, Math.max(1, Math.trunc(limit))));
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => UserProfileEntity)
  async setMyWorkPlaceByInn(
    @Args('input') input: SetMyWorkPlaceByInnInput,
    @CurrentUser() user: CurrentUserPayload,
    @Context() context: { req: Request },
  ): Promise<UserProfileEntity> {
    // 1) Try DB
    const fromDb = await this.organizationService.findByInn({
      inn: input.inn,
      kpp: input.kpp,
    });

    let orgId: string;

    if (fromDb) {
      orgId = fromDb._id.toString();
    } else {
      // 2) DaData suggest by INN and take first match with same inn (+kpp if provided)
      const suggestions = await this.dadataPartyService.suggest({
        query: input.inn,
        count: 10,
        ip: getClientIp(context.req),
      });

      const inn = input.inn.replace(/\D+/g, '');
      const kpp = typeof input.kpp === 'string' ? input.kpp.trim() : undefined;

      const picked =
        suggestions.find((s) => s.inn === inn && (kpp ? s.kpp === kpp : true)) ??
        suggestions.find((s) => s.inn === inn);

      if (!picked) {
        throw new NotFoundException('Organization not found by INN');
      }

      const org = await this.organizationService.upsertFromSuggestion(picked);
      orgId = org._id.toString();
    }

    const profile = await this.userService.upsertProfile(user.id, {
      workPlaceId: orgId,
    } as UpdateMyProfileInput);

    return toUserProfileEntity(profile) as UserProfileEntity;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => UserProfileEntity)
  async setMyWorkPlaceManual(
    @Args('input') input: SetMyWorkPlaceManualInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserProfileEntity> {
    const org = await this.organizationService.upsertManual(input);

    const profile = await this.userService.upsertProfile(user.id, {
      workPlaceId: org._id.toString(),
    } as UpdateMyProfileInput);

    return toUserProfileEntity(profile) as UserProfileEntity;
  }
}

