import { Module } from '@nestjs/common';
import { CacheModule } from 'src/cache/cache.module';
import { StorageModule } from 'src/storage/storage.module';
import { NewsResolver } from './news.resolver';
import { NewsService } from './news.service';

@Module({
  imports: [CacheModule, StorageModule],
  providers: [NewsService, NewsResolver],
  exports: [NewsService],
})
export class NewsModule {}
