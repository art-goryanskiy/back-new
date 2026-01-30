import { Args, Context, Int, Query, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { AddressSuggestionEntity } from '../gql/user.entity';
import { DadataAddressService } from '../services/dadata-address.service';
import { getClientIp } from './user-auth.resolver.utils';

@Resolver(() => AddressSuggestionEntity)
export class AddressSuggestionsResolver {
  constructor(private readonly dadataAddressService: DadataAddressService) {}

  @Query(() => [AddressSuggestionEntity])
  async addressSuggestions(
    @Args('query', { type: () => String }) query: string,
    @Args('count', { type: () => Int, nullable: true }) count: number | null,
    @Context() context: { req: Request },
  ): Promise<AddressSuggestionEntity[]> {
    return this.dadataAddressService.suggestAddress({
      query,
      count: count ?? undefined,
      ip: getClientIp(context.req),
    });
  }
}

