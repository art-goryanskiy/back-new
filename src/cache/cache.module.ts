import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CacheService],
  imports: [ConfigModule],
  exports: [CacheService],
})
export class CacheModule {}
