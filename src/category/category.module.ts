import { Module, forwardRef } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Category, CategorySchema } from './category.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoryResolver } from './category.resolver';
import { StorageModule } from 'src/storage/storage.module';
import { ProgramsModule } from 'src/programs/programs.module';
import { UserModule } from 'src/user/user.module';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';

@Module({
  providers: [CategoryService, CategoryResolver, FileCleanupService],
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
    ]),
    StorageModule,
    forwardRef(() => ProgramsModule),
    forwardRef(() => UserModule),
  ],
  exports: [CategoryService],
})
export class CategoryModule {}
