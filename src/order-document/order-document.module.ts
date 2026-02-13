import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OrderDocumentModel,
  OrderDocumentSchema,
} from './order-document.schema';
import { OrderDocumentService } from './order-document.service';
import { OrderDocumentResolver } from './order-document.resolver';
import { TrainingApplicationGenerator } from './training-application.generator';
import { CandidateApplicationGenerator } from './candidate-application.generator';
import { ContractActGenerator } from './contract-act.generator';
import { ContractDocxGenerator } from './contract-docx.generator';
import { OrderDocumentGenerationService } from './order-document-generation.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { OrderModule } from '../order/order.module';
import { OrganizationModule } from '../organization/organization.module';
import { UserModule } from '../user/user.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderDocumentModel.name, schema: OrderDocumentSchema },
    ]),
    forwardRef(() => OrderModule),
    OrganizationModule,
    UserModule,
    StorageModule,
  ],
  providers: [
    OrderDocumentService,
    OrderDocumentResolver,
    TrainingApplicationGenerator,
    CandidateApplicationGenerator,
    ContractActGenerator,
    ContractDocxGenerator,
    OrderDocumentGenerationService,
    AdminGuard,
  ],
  exports: [OrderDocumentService, OrderDocumentGenerationService],
})
export class OrderDocumentModule {}
