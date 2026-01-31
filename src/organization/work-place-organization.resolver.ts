import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UserWorkPlaceEntity } from 'src/user/gql/entities/user-profile.entity';
import { OrganizationEntity } from './organization.entity';
import { OrganizationService } from './organization.service';
import { toOrganizationEntity } from 'src/common/mappers/organization.mapper';

@Resolver(() => UserWorkPlaceEntity)
export class WorkPlaceOrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @ResolveField(() => OrganizationEntity)
  async organization(
    @Parent() parent: UserWorkPlaceEntity & { organizationId?: string },
  ): Promise<OrganizationEntity> {
    const id = parent.organizationId;
    if (!id) {
      throw new Error('workPlace.organizationId is required to resolve organization');
    }
    const org = await this.organizationService.findById(id);
    return toOrganizationEntity(org) as OrganizationEntity;
  }
}
