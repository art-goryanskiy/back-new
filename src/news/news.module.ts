import { Module } from '@nestjs/common';
import { NewsResolver } from './news.resolver';
import { NewsService } from './news.service';

@Module({
  providers: [NewsService, NewsResolver],
  exports: [NewsService],
})
export class NewsModule {}
