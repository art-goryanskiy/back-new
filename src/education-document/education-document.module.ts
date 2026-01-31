import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';
import {
  EducationDocument,
  EducationDocumentSchema,
} from './education-document.schema';
import { EducationDocumentService } from './education-document.service';
import { EducationDocumentResolver } from './education-document.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EducationDocument.name, schema: EducationDocumentSchema },
    ]),
    StorageModule,
    forwardRef(() => UserModule),
  ],
  providers: [
    EducationDocumentService,
    EducationDocumentResolver,
    FileCleanupService,
  ],
  exports: [EducationDocumentService],
})
export class EducationDocumentModule {}
