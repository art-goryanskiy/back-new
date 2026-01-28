import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';

@Module({
  controllers: [UploadController],
  imports: [StorageModule, UserModule],
})
export class UploadModule {}
