import { Module, forwardRef } from '@nestjs/common';
import { ProgramsResolver } from './programs.resolver';
import { ProgramsService } from './programs.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Program, ProgramSchema } from './program.schema';
import { CategoryModule } from 'src/category/category.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';

@Module({
  providers: [ProgramsResolver, ProgramsService, FileCleanupService],
  imports: [
    MongooseModule.forFeature([{ name: Program.name, schema: ProgramSchema }]),
    forwardRef(() => CategoryModule),
    StorageModule,
    forwardRef(() => UserModule),
  ],
  exports: [ProgramsService],
})
export class ProgramsModule {}
