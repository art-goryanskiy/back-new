import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { OrderEntity } from './order.entity';
import { OrderService } from './order.service';
import { AdminOrdersFilterInput } from './order.input';
import { OrderStatus } from './order.enums';
import { toOrderEntity, toOrderEntityArray } from 'src/common/mappers/order.mapper';

@Resolver(() => OrderEntity)
export class OrderAdminResolver {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => [OrderEntity], {
    name: 'adminOrders',
    description: 'Список заявок (только для админа)',
  })
  async adminOrders(
    @Args('filter', { type: () => AdminOrdersFilterInput, nullable: true })
    filter: AdminOrdersFilterInput | undefined,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderEntity[]> {
    const orders = await this.orderService.findAllOrders({
      status: filter?.status,
      userId: filter?.userId,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return toOrderEntityArray(orders);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => OrderEntity, {
    name: 'adminOrder',
    description: 'Одна заявка по ID (только для админа)',
  })
  async adminOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.findById(id);
    const entity = toOrderEntity(order);
    if (!entity) throw new Error('Order not found');
    return entity;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => OrderEntity, {
    name: 'adminUpdateOrderStatus',
    description: 'Изменить статус заявки (только для админа)',
  })
  async adminUpdateOrderStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('status', { type: () => OrderStatus }) status: OrderStatus,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<OrderEntity> {
    const order = await this.orderService.adminUpdateOrderStatus(
      orderId,
      status,
    );
    const entity = toOrderEntity(order);
    if (!entity) throw new Error('Order not found');
    return entity;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => Boolean, {
    name: 'adminDeleteOrder',
    description: 'Удалить заявку (только для админа)',
  })
  async adminDeleteOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() _user: CurrentUserPayload,
  ): Promise<boolean> {
    return this.orderService.adminDeleteOrder(orderId);
  }
}
