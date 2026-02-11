import { Args, Query, Resolver } from '@nestjs/graphql';
import { NewsItemEntity } from './news.entity';
import { NewsService } from './news.service';
import { NewsFilterInput } from './news.input';

@Resolver(() => NewsItemEntity)
export class NewsResolver {
  constructor(private readonly newsService: NewsService) {}

  @Query(() => [NewsItemEntity], {
    description: 'Новости со стены сообщества ВКонтакте',
  })
  async news(
    @Args('filter', { nullable: true, type: () => NewsFilterInput })
    filter?: NewsFilterInput,
  ): Promise<NewsItemEntity[]> {
    return this.newsService.getNews(filter);
  }
}
