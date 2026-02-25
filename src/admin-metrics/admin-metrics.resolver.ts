import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { AdminMetricsEntity } from './admin-metrics.entity';
import { AdminMetricsService } from './admin-metrics.service';

@Resolver(() => AdminMetricsEntity)
export class AdminMetricsResolver {
  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => AdminMetricsEntity, {
    name: 'adminMetrics',
    description:
      'Сводные метрики для админки: заказы, выручка, пользователи, чаты, корзины.',
  })
  async adminMetrics(
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<AdminMetricsEntity> {
    return this.adminMetricsService.getMetrics();
  }
}
