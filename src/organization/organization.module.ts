import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Organization, OrganizationSchema } from './organization.schema';
import { OrganizationResolver } from './organization.resolver';
import { WorkPlaceOrganizationResolver } from './work-place-organization.resolver';
import { OrganizationService } from './organization.service';
import { DadataPartyService } from './dadata-party.service';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    UserModule,
  ],
  providers: [
    OrganizationResolver,
    WorkPlaceOrganizationResolver,
    OrganizationService,
    DadataPartyService,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
